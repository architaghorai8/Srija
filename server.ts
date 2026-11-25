import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import {
  type AuthenticatedRequest,
  createRateLimiter,
  createUserNotification,
  hashPassword,
  logAudit,
  logUserActivity,
  requireAdmin,
  requireAuth,
  signSessionToken,
  verifyPassword,
} from './src/server/auth.ts';
import {
  classifySequencesAgainstReference,
  parseSequenceFile,
  SAMPLE_EDNA_DATASETS,
} from './src/server/bioinformatics.ts';
import { db, uploadsDir } from './src/server/db.ts';
import { getSupabaseStatus, syncDatasetToSupabase } from './src/server/supabaseConnector.ts';

dotenv.config();

const app = express();
const PORT = 3000;

app.set('trust proxy', 1);
app.use(express.json({ limit: '12mb' }));

const authLimiter = createRateLimiter(25, 15 * 60 * 1000, 'auth');
const analyzeLimiter = createRateLimiter(30, 15 * 60 * 1000, 'analyze');
const adminLimiter = createRateLimiter(30, 15 * 60 * 1000, 'admin');

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isStrongPassword(password: string): boolean {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

function sanitizeUser(row: Record<string, unknown>) {
  return {
    uid: row.uid,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone || '',
    institution: row.institution || '',
    country: row.country || 'Global',
    userCategory: row.user_category || 'Researcher',
    role: row.role || 'user',
    status: row.status || 'active',
    profileImage: row.profile_image || '',
    emailVerified: Boolean(row.email_verified),
    notifyAnalysis: Boolean(row.notify_analysis),
    notifySecurity: Boolean(row.notify_security),
    notifyDigest: Boolean(row.notify_digest),
    lastLoginAt: row.last_login_at || null,
    createdAt: row.created_at,
  };
}

// ---------- AUTHENTICATION ROUTES ----------

app.get('/api/auth/google-status', (_req, res) => {
  const configured = Boolean(process.env.VITE_FIREBASE_API_KEY?.trim() || process.env.GOOGLE_CLIENT_ID?.trim());
  res.json({
    configured,
    message: configured
      ? 'Google Sign-In is configured.'
      : 'Google Sign-In requires Firebase Auth or Google OAuth client credentials in environment configuration. Use email and password registration/login directly.',
  });
});

app.post('/api/auth/register', authLimiter, (req, res) => {
  try {
    const {
      fullName,
      email,
      phone = '',
      institution = '',
      country,
      userCategory,
      password,
      confirmPassword,
      acceptedTerms,
      acceptedPrivacy,
    } = req.body || {};

    if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 2) {
      res.status(400).json({ error: 'Please enter your full name (at least 2 characters).' });
      return;
    }
    if (!email || typeof email !== 'string' || !isValidEmail(email.trim())) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }
    if (!country || typeof country !== 'string' || country.trim().length < 2) {
      res.status(400).json({ error: 'Please select or enter your country.' });
      return;
    }
    const allowedCategories = ['Student', 'Researcher', 'Scientist', 'Teacher', 'General user'];
    if (!allowedCategories.includes(userCategory)) {
      res.status(400).json({ error: 'Please select a valid user category.' });
      return;
    }
    if (!password || typeof password !== 'string' || !isStrongPassword(password)) {
      res.status(400).json({
        error:
          'Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character.',
      });
      return;
    }
    if (password !== confirmPassword) {
      res.status(400).json({ error: 'Password and confirm password do not match.' });
      return;
    }
    if (!acceptedTerms || !acceptedPrivacy) {
      res.status(400).json({ error: 'You must accept the Terms & Conditions and Privacy Policy.' });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = db.prepare('SELECT uid FROM users WHERE email = ?').get(normalizedEmail);
    if (existing) {
      res.status(409).json({ error: 'An account with this email address already exists.' });
      return;
    }

    const uid = crypto.randomUUID();
    const { hash, salt } = hashPassword(password);
    const verificationToken = crypto.randomBytes(24).toString('hex');
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO users (
        uid, full_name, email, phone, institution, country, user_category,
        role, status, profile_image, email_verified, verification_token,
        password_hash, password_salt, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'user', 'active', '', 0, ?, ?, ?, ?, ?)
    `).run(
      uid,
      fullName.trim().slice(0, 120),
      normalizedEmail,
      String(phone || '').trim().slice(0, 40),
      String(institution || '').trim().slice(0, 160),
      country.trim().slice(0, 80),
      userCategory,
      verificationToken,
      hash,
      salt,
      now,
      now
    );

    logUserActivity(uid, 'ACCOUNT_REGISTERED', 'Registered new eDNA BioScope researcher account', req.ip || '');
    createUserNotification(
      uid,
      'Welcome to eDNA BioScope',
      'Verify your email address to begin uploading FASTA/FASTQ datasets and assessing biodiversity.'
    );

    const smtpConfigured = Boolean(process.env.SMTP_HOST?.trim());
    res.status(201).json({
      message: smtpConfigured
        ? 'Account created. A verification link has been sent to your email address.'
        : 'Account created. Verify your email address below to activate your session.',
      requiresEmailVerification: true,
      email: normalizedEmail,
      // Only return preview verification token when external SMTP is not configured
      previewVerificationToken: smtpConfigured ? undefined : verificationToken,
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed due to a server error.' });
  }
});

app.post('/api/auth/verify-email', authLimiter, (req, res) => {
  try {
    const { email, token } = req.body || {};
    if (!email || !token || typeof email !== 'string' || typeof token !== 'string') {
      res.status(400).json({ error: 'Email and verification token are required.' });
      return;
    }
    const normalizedEmail = email.trim().toLowerCase();
    const user = db
      .prepare('SELECT * FROM users WHERE email = ?')
      .get(normalizedEmail) as Record<string, unknown> | undefined;

    if (!user) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }
    if (user.email_verified) {
      res.json({ message: 'Email address is already verified. You may now sign in.' });
      return;
    }
    if (user.verification_token !== token.trim()) {
      res.status(400).json({ error: 'Invalid or expired verification token.' });
      return;
    }

    const now = new Date().toISOString();
    db.prepare('UPDATE users SET email_verified = 1, verification_token = ?, updated_at = ? WHERE uid = ?').run(
      '',
      now,
      String(user.uid)
    );
    logUserActivity(String(user.uid), 'EMAIL_VERIFIED', 'Verified account email address', req.ip || '');
    createUserNotification(
      String(user.uid),
      'Email Verified',
      'Your email address has been verified. All dataset analysis modules are unlocked.'
    );

    res.json({ message: 'Email verified successfully. You can now sign in.' });
  } catch (err) {
    console.error('Verify email error:', err);
    res.status(500).json({ error: 'Failed to verify email.' });
  }
});

app.post('/api/auth/resend-verification', authLimiter, (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email || typeof email !== 'string' || !isValidEmail(email)) {
      res.status(400).json({ error: 'Valid email address is required.' });
      return;
    }
    const normalizedEmail = email.trim().toLowerCase();
    const user = db.prepare('SELECT uid, email_verified FROM users WHERE email = ?').get(normalizedEmail) as
      | { uid: string; email_verified: number }
      | undefined;
    if (!user) {
      res.json({ message: 'If an unverified account exists for that email, a verification token has been issued.' });
      return;
    }
    if (user.email_verified) {
      res.json({ message: 'This email is already verified.' });
      return;
    }
    const newToken = crypto.randomBytes(24).toString('hex');
    db.prepare('UPDATE users SET verification_token = ?, updated_at = ? WHERE uid = ?').run(
      newToken,
      new Date().toISOString(),
      user.uid
    );
    const smtpConfigured = Boolean(process.env.SMTP_HOST?.trim());
    res.json({
      message: 'A new verification token has been issued.',
      previewVerificationToken: smtpConfigured ? undefined : newToken,
    });
  } catch (err) {
    console.error('Resend verification error:', err);
    res.status(500).json({ error: 'Unable to resend verification.' });
  }
});

app.post('/api/auth/login', authLimiter, (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = db
      .prepare('SELECT * FROM users WHERE email = ?')
      .get(normalizedEmail) as Record<string, unknown> | undefined;

    if (!user || !verifyPassword(password, String(user.password_hash), String(user.password_salt))) {
      res.status(401).json({ error: 'Invalid email address or password.' });
      return;
    }

    if (user.status !== 'active') {
      res.status(403).json({ error: 'Your account has been suspended. Please contact support.' });
      return;
    }

    if (!user.email_verified) {
      res.status(403).json({
        error: 'Email verification is pending. Please verify your email address before signing in.',
        code: 'EMAIL_NOT_VERIFIED',
        email: normalizedEmail,
      });
      return;
    }

    const now = new Date().toISOString();
    db.prepare('UPDATE users SET last_login_at = ?, updated_at = ? WHERE uid = ?').run(now, now, String(user.uid));
    logUserActivity(String(user.uid), 'LOGIN', 'Signed in to eDNA BioScope', req.ip || '');

    const role = user.role === 'admin' ? 'admin' : 'user';
    const token = signSessionToken({
      uid: String(user.uid),
      email: String(user.email),
      role,
    });

    res.json({
      token,
      user: sanitizeUser({ ...user, last_login_at: now }),
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Authentication failed due to a server error.' });
  }
});

app.post('/api/auth/forgot-password', authLimiter, (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email || typeof email !== 'string' || !isValidEmail(email)) {
      res.status(400).json({ error: 'Please provide a valid email address.' });
      return;
    }
    const normalizedEmail = email.trim().toLowerCase();
    const user = db.prepare('SELECT uid FROM users WHERE email = ?').get(normalizedEmail) as
      | { uid: string }
      | undefined;

    if (!user) {
      res.json({ message: 'If an account matches that email, password reset instructions have been prepared.' });
      return;
    }

    const rawToken = crypto.randomBytes(20).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    db.prepare(
      'INSERT INTO password_resets (id, uid, token_hash, expires_at, used, created_at) VALUES (?, ?, ?, ?, 0, ?)'
    ).run(crypto.randomUUID(), user.uid, tokenHash, expiresAt, new Date().toISOString());

    logUserActivity(user.uid, 'PASSWORD_RESET_REQUESTED', 'Requested password reset token', req.ip || '');
    const smtpConfigured = Boolean(process.env.SMTP_HOST?.trim());
    res.json({
      message: smtpConfigured
        ? 'Password reset instructions sent to your email.'
        : 'Password reset token generated (SMTP not configured — enter this token below to reset your password).',
      previewResetToken: smtpConfigured ? undefined : rawToken,
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Unable to process password reset request.' });
  }
});

app.post('/api/auth/reset-password', authLimiter, (req, res) => {
  try {
    const { email, token, newPassword, confirmPassword } = req.body || {};
    if (!email || !token || !newPassword || typeof newPassword !== 'string') {
      res.status(400).json({ error: 'Email, reset token, and new password are required.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      res.status(400).json({ error: 'Passwords do not match.' });
      return;
    }
    if (!isStrongPassword(newPassword)) {
      res.status(400).json({
        error:
          'New password must be at least 8 characters with uppercase, lowercase, number, and special character.',
      });
      return;
    }

    const user = db.prepare('SELECT uid FROM users WHERE email = ?').get(String(email).trim().toLowerCase()) as
      | { uid: string }
      | undefined;
    if (!user) {
      res.status(400).json({ error: 'Invalid reset request.' });
      return;
    }

    const tokenHash = crypto.createHash('sha256').update(String(token).trim()).digest('hex');
    const resetRow = db
      .prepare('SELECT * FROM password_resets WHERE uid = ? AND token_hash = ? AND used = 0 ORDER BY created_at DESC LIMIT 1')
      .get(user.uid, tokenHash) as { id: string; expires_at: string } | undefined;

    if (!resetRow || new Date(resetRow.expires_at).getTime() < Date.now()) {
      res.status(400).json({ error: 'Reset token is invalid or has expired.' });
      return;
    }

    const { hash, salt } = hashPassword(newPassword);
    const now = new Date().toISOString();
    db.prepare('UPDATE users SET password_hash = ?, password_salt = ?, updated_at = ? WHERE uid = ?').run(
      hash,
      salt,
      now,
      user.uid
    );
    db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').run(resetRow.id);
    logUserActivity(user.uid, 'PASSWORD_RESET', 'Completed password reset', req.ip || '');

    res.json({ message: 'Password updated successfully. You may now sign in.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Failed to reset password.' });
  }
});

app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
  const uid = req.authUser!.uid;
  const user = db.prepare('SELECT * FROM users WHERE uid = ?').get(uid) as Record<string, unknown> | undefined;
  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }
  const activities = db
    .prepare('SELECT * FROM user_activity WHERE uid = ? ORDER BY timestamp DESC LIMIT 20')
    .all(uid);
  const notifications = db
    .prepare('SELECT * FROM notifications WHERE uid = ? ORDER BY created_at DESC LIMIT 20')
    .all(uid);

  res.json({
    user: sanitizeUser(user),
    activities,
    notifications,
  });
});

app.patch('/api/auth/profile', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.authUser!.uid;
    const {
      fullName,
      phone,
      institution,
      country,
      userCategory,
      profileImage,
      notifyAnalysis,
      notifySecurity,
      notifyDigest,
    } = req.body || {};

    const allowedCategories = ['Student', 'Researcher', 'Scientist', 'Teacher', 'General user'];
    const current = db.prepare('SELECT * FROM users WHERE uid = ?').get(uid) as Record<string, unknown>;

    const nextFullName =
      typeof fullName === 'string' && fullName.trim().length >= 2 ? fullName.trim().slice(0, 120) : current.full_name;
    const nextPhone = typeof phone === 'string' ? phone.trim().slice(0, 40) : current.phone;
    const nextInst = typeof institution === 'string' ? institution.trim().slice(0, 160) : current.institution;
    const nextCountry =
      typeof country === 'string' && country.trim().length >= 2 ? country.trim().slice(0, 80) : current.country;
    const nextCategory = allowedCategories.includes(userCategory) ? userCategory : current.user_category;

    let nextImage = String(current.profile_image || '');
    if (typeof profileImage === 'string') {
      if (
        profileImage === '' ||
        profileImage.startsWith('/src/assets/images/') ||
        /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/.test(profileImage)
      ) {
        if (profileImage.length <= 2_000_000) {
          nextImage = profileImage;
        }
      }
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE users
      SET full_name = ?, phone = ?, institution = ?, country = ?, user_category = ?,
          profile_image = ?, notify_analysis = ?, notify_security = ?, notify_digest = ?, updated_at = ?
      WHERE uid = ?
    `).run(
      String(nextFullName),
      String(nextPhone || ''),
      String(nextInst || ''),
      String(nextCountry),
      String(nextCategory),
      nextImage,
      typeof notifyAnalysis === 'boolean' ? (notifyAnalysis ? 1 : 0) : Number(current.notify_analysis),
      typeof notifySecurity === 'boolean' ? (notifySecurity ? 1 : 0) : Number(current.notify_security),
      typeof notifyDigest === 'boolean' ? (notifyDigest ? 1 : 0) : Number(current.notify_digest),
      now,
      uid
    );

    logUserActivity(uid, 'PROFILE_UPDATED', 'Updated researcher profile and preferences', req.ip || '');
    const updated = db.prepare('SELECT * FROM users WHERE uid = ?').get(uid) as Record<string, unknown>;
    res.json({ user: sanitizeUser(updated), message: 'Profile updated successfully.' });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

app.post('/api/auth/change-password', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.authUser!.uid;
    const { currentPassword, newPassword, confirmPassword } = req.body || {};
    if (!currentPassword || !newPassword || newPassword !== confirmPassword) {
      res.status(400).json({ error: 'Please complete all password fields and ensure new passwords match.' });
      return;
    }
    if (!isStrongPassword(newPassword)) {
      res.status(400).json({
        error:
          'New password must be at least 8 characters with uppercase, lowercase, a number, and a special character.',
      });
      return;
    }
    const user = db.prepare('SELECT password_hash, password_salt FROM users WHERE uid = ?').get(uid) as {
      password_hash: string;
      password_salt: string;
    };
    if (!verifyPassword(currentPassword, user.password_hash, user.password_salt)) {
      res.status(401).json({ error: 'Current password is incorrect.' });
      return;
    }
    const { hash, salt } = hashPassword(newPassword);
    db.prepare('UPDATE users SET password_hash = ?, password_salt = ?, updated_at = ? WHERE uid = ?').run(
      hash,
      salt,
      new Date().toISOString(),
      uid
    );
    logUserActivity(uid, 'PASSWORD_CHANGED', 'Changed account password', req.ip || '');
    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Failed to change password.' });
  }
});

app.post('/api/auth/notifications/read-all', requireAuth, (req: AuthenticatedRequest, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE uid = ?').run(req.authUser!.uid);
  res.json({ ok: true });
});

// ---------- DATASETS & BIOINFORMATICS ANALYSIS ----------

app.get('/api/datasets/samples', requireAuth, (_req, res) => {
  res.json({ samples: SAMPLE_EDNA_DATASETS });
});

app.post('/api/datasets/analyze', analyzeLimiter, requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.authUser!.uid;
    const {
      datasetName,
      sampleId,
      sampleType,
      location,
      latitude,
      longitude,
      collectionDate,
      notes = '',
      fileName,
      fileContent,
      fileFormat,
    } = req.body || {};

    if (!datasetName || typeof datasetName !== 'string' || datasetName.trim().length < 2) {
      res.status(400).json({ error: 'Dataset name is required (minimum 2 characters).' });
      return;
    }
    if (!sampleId || typeof sampleId !== 'string' || sampleId.trim().length < 1) {
      res.status(400).json({ error: 'Sample ID is required.' });
      return;
    }
    const allowedSampleTypes = ['water', 'soil', 'sediment', 'air', 'biofilm', 'tissue', 'other'];
    if (!allowedSampleTypes.includes(sampleType)) {
      res.status(400).json({ error: 'Invalid sample type.' });
      return;
    }
    if (!location || typeof location !== 'string' || location.trim().length < 2) {
      res.status(400).json({ error: 'Sample location is required.' });
      return;
    }
    if (!collectionDate || typeof collectionDate !== 'string') {
      res.status(400).json({ error: 'Collection date is required.' });
      return;
    }
    const allowedFormats = ['fasta', 'fastq', 'csv', 'txt'];
    if (!allowedFormats.includes(fileFormat)) {
      res.status(400).json({ error: 'Unsupported file format. Accepted: FASTA, FASTQ, CSV, TXT.' });
      return;
    }
    if (!fileContent || typeof fileContent !== 'string') {
      res.status(400).json({ error: 'Sequence file content is required.' });
      return;
    }

    const byteSize = Buffer.byteLength(fileContent, 'utf8');
    if (byteSize > 10 * 1024 * 1024) {
      res.status(413).json({ error: 'File exceeds the 10 MB maximum upload limit.' });
      return;
    }

    const parsed = parseSequenceFile(fileContent, fileFormat);
    const analysis = classifySequencesAgainstReference(parsed.records);

    const datasetId = crypto.randomUUID();
    const jobId = crypto.randomUUID();
    const now = new Date().toISOString();

    const userDir = path.resolve(uploadsDir, uid.replace(/[^a-zA-Z0-9_-]/g, '_'));
    if (!userDir.startsWith(uploadsDir + path.sep)) {
      res.status(400).json({ error: 'Invalid storage path.' });
      return;
    }
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    const safeExt = fileFormat === 'fasta' ? 'fasta' : fileFormat === 'fastq' ? 'fastq' : fileFormat === 'csv' ? 'csv' : 'txt';
    const destPath = path.resolve(userDir, `${datasetId}.${safeExt}`);
    if (!destPath.startsWith(userDir + path.sep)) {
      res.status(400).json({ error: 'Invalid file destination.' });
      return;
    }
    fs.writeFileSync(destPath, fileContent, 'utf8');

    const latNum = latitude !== undefined && latitude !== '' && !Number.isNaN(Number(latitude)) ? Number(latitude) : null;
    const lngNum = longitude !== undefined && longitude !== '' && !Number.isNaN(Number(longitude)) ? Number(longitude) : null;

    db.prepare(`
      INSERT INTO datasets (
        id, user_id, dataset_name, sample_id, sample_type, location, latitude, longitude,
        collection_date, notes, file_path, file_format, file_size, sequence_count,
        gc_content, mean_read_length, mean_quality_score, upload_status, analysis_mode, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?)
    `).run(
      datasetId,
      uid,
      datasetName.trim().slice(0, 160),
      sampleId.trim().slice(0, 80),
      sampleType,
      location.trim().slice(0, 160),
      latNum,
      lngNum,
      collectionDate.trim().slice(0, 32),
      String(notes || '').trim().slice(0, 1000),
      path.relative(process.cwd(), destPath),
      fileFormat,
      byteSize,
      parsed.records.length,
      parsed.gcContent,
      parsed.meanReadLength,
      parsed.meanQualityScore,
      analysis.analysisMode,
      now
    );

    db.prepare(`
      INSERT INTO analysis_jobs (id, dataset_id, user_id, status, progress, analysis_mode, started_at, completed_at, error_message)
      VALUES (?, ?, ?, 'completed', 100, ?, ?, ?, NULL)
    `).run(jobId, datasetId, uid, analysis.analysisMode, now, now);

    const insertTaxon = db.prepare(`
      INSERT INTO taxonomic_results (
        id, dataset_id, scientific_name, common_name, kingdom, phylum, class_name,
        order_name, family, genus, species, read_count, relative_abundance,
        similarity, confidence, uncertain_matches_json, reference_database, accession_id, marker_gene
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const taxonRowsForSync: Array<Record<string, unknown>> = [];
    for (const r of analysis.results) {
      const tid = crypto.randomUUID();
      insertTaxon.run(
        tid,
        datasetId,
        r.scientific_name,
        r.common_name,
        r.kingdom,
        r.phylum,
        r.class_name,
        r.order_name,
        r.family,
        r.genus,
        r.species,
        r.read_count,
        r.relative_abundance,
        r.similarity,
        r.confidence,
        JSON.stringify(r.uncertain_matches),
        r.reference_database,
        r.accession_id,
        r.marker_gene
      );
      taxonRowsForSync.push({
        id: tid,
        dataset_id: datasetId,
        scientific_name: r.scientific_name,
        common_name: r.common_name,
        kingdom: r.kingdom,
        phylum: r.phylum,
        class: r.class_name,
        order_name: r.order_name,
        family: r.family,
        genus: r.genus,
        species: r.species,
        read_count: r.read_count,
        relative_abundance: r.relative_abundance,
        similarity: r.similarity,
        confidence: r.confidence,
        uncertain_matches: r.uncertain_matches,
        reference_database: r.reference_database,
        accession_id: r.accession_id,
        marker_gene: r.marker_gene,
      });
    }

    const metricsId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO biodiversity_metrics (
        id, dataset_id, species_richness, shannon_index, simpson_index,
        simpson_diversity, evenness_index, total_reads, abundance_supported, calculated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      metricsId,
      datasetId,
      analysis.metrics.species_richness,
      analysis.metrics.shannon_index,
      analysis.metrics.simpson_index,
      analysis.metrics.simpson_diversity,
      analysis.metrics.evenness_index,
      analysis.metrics.total_reads,
      analysis.metrics.abundance_supported ? 1 : 0,
      now
    );

    // Optional external Supabase sync when configured
    const supabaseSync = await syncDatasetToSupabase({
      dataset: {
        id: datasetId,
        user_id: uid,
        dataset_name: datasetName.trim().slice(0, 160),
        sample_id: sampleId.trim().slice(0, 80),
        sample_type: sampleType,
        location: location.trim().slice(0, 160),
        latitude: latNum,
        longitude: lngNum,
        collection_date: collectionDate,
        notes: String(notes || '').trim(),
        file_path: path.relative(process.cwd(), destPath),
        file_format: fileFormat,
        file_size: byteSize,
        sequence_count: parsed.records.length,
        gc_content: parsed.gcContent,
        upload_status: 'completed',
        analysis_mode: analysis.analysisMode,
        created_at: now,
      },
      job: {
        id: jobId,
        dataset_id: datasetId,
        user_id: uid,
        status: 'completed',
        progress: 100,
        analysis_mode: analysis.analysisMode,
        started_at: now,
        completed_at: now,
      },
      results: taxonRowsForSync,
      metrics: {
        id: metricsId,
        dataset_id: datasetId,
        species_richness: analysis.metrics.species_richness,
        shannon_index: analysis.metrics.shannon_index,
        simpson_index: analysis.metrics.simpson_index,
        simpson_diversity: analysis.metrics.simpson_diversity,
        evenness_index: analysis.metrics.evenness_index,
        total_reads: analysis.metrics.total_reads,
        abundance_supported: analysis.metrics.abundance_supported,
        calculated_at: now,
      },
    });

    logUserActivity(
      uid,
      'DATASET_ANALYZED',
      `Analyzed "${datasetName.trim()}" (${parsed.records.length} sequences, ${analysis.results.length} taxa identified)`,
      req.ip || ''
    );
    createUserNotification(
      uid,
      'Analysis Complete',
      `Dataset "${datasetName.trim()}" finished processing with ${analysis.results.length} taxa identified (H' = ${analysis.metrics.shannon_index.toFixed(2)}).`
    );

    const datasetRecord = db.prepare('SELECT * FROM datasets WHERE id = ?').get(datasetId);
    const savedResults = db
      .prepare('SELECT * FROM taxonomic_results WHERE dataset_id = ? ORDER BY confidence DESC')
      .all(datasetId) as Array<Record<string, unknown>>;
    const savedMetrics = db.prepare('SELECT * FROM biodiversity_metrics WHERE dataset_id = ?').get(datasetId);

    res.status(201).json({
      dataset: datasetRecord,
      job: db.prepare('SELECT * FROM analysis_jobs WHERE id = ?').get(jobId),
      results: savedResults.map((r) => ({
        ...r,
        uncertain_matches: JSON.parse(String(r.uncertain_matches_json || '[]')),
      })),
      metrics: savedMetrics,
      warnings: parsed.warnings,
      fileName: fileName || `${datasetId}.${safeExt}`,
      supabaseSync,
    });
  } catch (err) {
    console.error('Analyze dataset error:', err);
    res.status(400).json({
      error: err instanceof Error ? err.message : 'Failed to validate or analyze sequence dataset.',
    });
  }
});

app.get('/api/datasets', requireAuth, (req: AuthenticatedRequest, res) => {
  const uid = req.authUser!.uid;
  const rows = db
    .prepare(`
      SELECT d.*, b.species_richness, b.shannon_index, b.simpson_index, b.simpson_diversity, b.evenness_index, b.total_reads,
             j.status AS job_status, j.progress AS job_progress
      FROM datasets d
      LEFT JOIN biodiversity_metrics b ON b.dataset_id = d.id
      LEFT JOIN analysis_jobs j ON j.dataset_id = d.id
      WHERE d.user_id = ?
      ORDER BY d.created_at DESC
    `)
    .all(uid);
  res.json({ datasets: rows });
});

app.get('/api/datasets/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const uid = req.authUser!.uid;
  const datasetId = req.params.id;
  const dataset = db.prepare('SELECT * FROM datasets WHERE id = ? AND user_id = ?').get(datasetId, uid);
  if (!dataset) {
    res.status(404).json({ error: 'Dataset not found or access denied.' });
    return;
  }
  const job = db.prepare('SELECT * FROM analysis_jobs WHERE dataset_id = ?').get(datasetId);
  const results = db
    .prepare('SELECT * FROM taxonomic_results WHERE dataset_id = ? ORDER BY confidence DESC, read_count DESC')
    .all(datasetId) as Array<Record<string, unknown>>;
  const metrics = db.prepare('SELECT * FROM biodiversity_metrics WHERE dataset_id = ?').get(datasetId);

  res.json({
    dataset,
    job,
    results: results.map((r) => ({
      ...r,
      uncertain_matches: JSON.parse(String(r.uncertain_matches_json || '[]')),
    })),
    metrics,
  });
});

app.delete('/api/datasets/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const uid = req.authUser!.uid;
  const datasetId = req.params.id;
  const dataset = db.prepare('SELECT id, dataset_name, file_path FROM datasets WHERE id = ? AND user_id = ?').get(
    datasetId,
    uid
  ) as { id: string; dataset_name: string; file_path: string } | undefined;

  if (!dataset) {
    res.status(404).json({ error: 'Dataset not found or access denied.' });
    return;
  }

  const resolvedFile = path.resolve(process.cwd(), dataset.file_path);
  if (resolvedFile.startsWith(uploadsDir + path.sep) && fs.existsSync(resolvedFile)) {
    fs.unlinkSync(resolvedFile);
  }

  db.prepare('DELETE FROM datasets WHERE id = ? AND user_id = ?').run(datasetId, uid);
  logUserActivity(uid, 'DATASET_DELETED', `Deleted dataset "${dataset.dataset_name}"`, req.ip || '');
  res.json({ message: 'Dataset deleted.' });
});

app.get('/api/dashboard/summary', requireAuth, (req: AuthenticatedRequest, res) => {
  const uid = req.authUser!.uid;
  const datasets = db
    .prepare(`
      SELECT d.*, b.species_richness, b.shannon_index, b.simpson_index, b.simpson_diversity, b.evenness_index, b.total_reads
      FROM datasets d
      LEFT JOIN biodiversity_metrics b ON b.dataset_id = d.id
      WHERE d.user_id = ?
      ORDER BY d.collection_date ASC, d.created_at ASC
    `)
    .all(uid) as Array<Record<string, unknown>>;

  const taxa = db
    .prepare(`
      SELECT tr.*, d.dataset_name, d.location, d.collection_date, d.sample_type
      FROM taxonomic_results tr
      INNER JOIN datasets d ON d.id = tr.dataset_id
      WHERE d.user_id = ?
    `)
    .all(uid) as Array<Record<string, unknown>>;

  const activities = db
    .prepare('SELECT * FROM user_activity WHERE uid = ? ORDER BY timestamp DESC LIMIT 10')
    .all(uid);

  const distinctSpecies = new Set(taxa.map((t) => String(t.species)));
  const distinctGroups = new Set(taxa.map((t) => String(t.phylum)));
  const avgShannon =
    datasets.length > 0
      ? Number(
          (
            datasets.reduce((acc, d) => acc + Number(d.shannon_index || 0), 0) / datasets.length
          ).toFixed(3)
        )
      : 0;

  res.json({
    summary: {
      totalDatasets: datasets.length,
      totalSpeciesIdentified: distinctSpecies.size,
      totalTaxonomicGroups: distinctGroups.size,
      averageBiodiversityIndex: avgShannon,
    },
    datasets,
    taxa: taxa.map((t) => ({
      ...t,
      uncertain_matches: JSON.parse(String(t.uncertain_matches_json || '[]')),
    })),
    activities,
  });
});

// ---------- REPORTS ----------

app.get('/api/reports', requireAuth, (req: AuthenticatedRequest, res) => {
  const uid = req.authUser!.uid;
  const rows = db
    .prepare(`
      SELECT r.*, d.dataset_name, d.sample_id, d.location, d.collection_date
      FROM reports r
      INNER JOIN datasets d ON d.id = r.dataset_id
      WHERE r.user_id = ?
      ORDER BY r.created_at DESC
    `)
    .all(uid);
  res.json({ reports: rows });
});

app.post('/api/reports', requireAuth, (req: AuthenticatedRequest, res) => {
  const uid = req.authUser!.uid;
  const { datasetId, reportName, format } = req.body || {};
  if (!datasetId || !reportName || !['pdf', 'csv'].includes(format)) {
    res.status(400).json({ error: 'Valid datasetId, reportName, and format (pdf/csv) are required.' });
    return;
  }
  const dataset = db.prepare('SELECT id FROM datasets WHERE id = ? AND user_id = ?').get(datasetId, uid);
  if (!dataset) {
    res.status(404).json({ error: 'Dataset not found or access denied.' });
    return;
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO reports (id, user_id, dataset_id, report_name, format, file_path, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, uid, datasetId, String(reportName).trim().slice(0, 160), format, `client-export://${id}.${format}`, now);

  logUserActivity(uid, 'REPORT_GENERATED', `Exported ${format.toUpperCase()} report "${reportName}"`, req.ip || '');
  res.status(201).json({ id, created_at: now });
});

// ---------- SPECIES REFERENCE & LEARNING RESOURCES ----------

app.get('/api/species', (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  const kingdom = String(req.query.kingdom || '').trim();
  const category = String(req.query.category || '').trim();
  const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
  const pageSize = Math.min(50, Math.max(4, Number.parseInt(String(req.query.pageSize || '8'), 10) || 8));

  const allRows = db.prepare('SELECT * FROM species_reference ORDER BY scientific_name ASC').all() as Array<
    Record<string, unknown>
  >;

  const filtered = allRows.filter((r) => {
    if (kingdom && kingdom !== 'All' && r.kingdom !== kingdom) return false;
    if (category && category !== 'All' && r.organism_category !== category) return false;
    if (q) {
      const haystack = `${r.scientific_name} ${r.common_name} ${r.phylum} ${r.family} ${r.habitat} ${r.accession_id}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const items = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const kingdoms = Array.from(new Set(allRows.map((r) => String(r.kingdom)))).sort();
  const categories = Array.from(new Set(allRows.map((r) => String(r.organism_category)))).sort();

  res.json({
    items,
    total,
    page: safePage,
    pageSize,
    totalPages,
    facets: { kingdoms, categories },
  });
});

app.get('/api/learning', (_req, res) => {
  const modules = db
    .prepare('SELECT * FROM learning_modules WHERE published = 1 ORDER BY order_index ASC')
    .all();
  res.json({ modules });
});

// ---------- HIDDEN ADMINISTRATOR CONTROL CENTER (/secure-control-center) ----------

app.get('/api/admin/bootstrap-status', (_req, res) => {
  const envAdminConfigured = Boolean(process.env.ADMIN_EMAIL?.trim() && process.env.ADMIN_PASSCODE?.trim());
  const adminCount = db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'admin'").get() as { c: number };
  res.json({
    needsBootstrap: !envAdminConfigured && adminCount.c === 0,
    envAdminConfigured,
  });
});

app.post('/api/admin/bootstrap', adminLimiter, (req, res) => {
  try {
    const envAdminConfigured = Boolean(process.env.ADMIN_EMAIL?.trim() && process.env.ADMIN_PASSCODE?.trim());
    const adminCount = db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'admin'").get() as { c: number };
    if (envAdminConfigured || adminCount.c > 0) {
      res.status(403).json({ error: 'Administrator bootstrap is locked.' });
      return;
    }

    const { fullName, email, password, confirmPassword } = req.body || {};
    if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 2) {
      res.status(400).json({ error: 'Administrator name is required.' });
      return;
    }
    if (!email || typeof email !== 'string' || !isValidEmail(email.trim())) {
      res.status(400).json({ error: 'Valid administrator email is required.' });
      return;
    }
    if (!password || typeof password !== 'string' || !isStrongPassword(password)) {
      res.status(400).json({
        error:
          'Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character.',
      });
      return;
    }
    if (password !== confirmPassword) {
      res.status(400).json({ error: 'Passwords do not match.' });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = db.prepare('SELECT uid FROM users WHERE email = ?').get(normalizedEmail) as
      | { uid: string }
      | undefined;

    const { hash, salt } = hashPassword(password);
    const now = new Date().toISOString();
    let uid: string;
    if (existing) {
      uid = existing.uid;
      db.prepare(
        "UPDATE users SET full_name = ?, role = 'admin', status = 'active', email_verified = 1, password_hash = ?, password_salt = ?, updated_at = ? WHERE uid = ?"
      ).run(fullName.trim(), hash, salt, now, uid);
    } else {
      uid = crypto.randomUUID();
      db.prepare(`
        INSERT INTO users (
          uid, full_name, email, phone, institution, country, user_category,
          role, status, profile_image, email_verified, verification_token,
          password_hash, password_salt, created_at, updated_at
        ) VALUES (?, ?, ?, '', 'eDNA BioScope Administration', 'Global', 'Scientist', 'admin', 'active', '', 1, '', ?, ?, ?, ?)
      `).run(uid, fullName.trim(), normalizedEmail, hash, salt, now, now);
    }

    logAudit(uid, normalizedEmail, 'ADMIN_BOOTSTRAP_CLAIMED', 'user', uid, 'Initial administrator account claimed');
    const token = signSessionToken({ uid, email: normalizedEmail, role: 'admin' });
    const adminRow = db.prepare('SELECT * FROM users WHERE uid = ?').get(uid) as Record<string, unknown>;
    res.status(201).json({ token, user: sanitizeUser(adminRow) });
  } catch (err) {
    console.error('Admin bootstrap error:', err);
    res.status(500).json({ error: 'Failed to initialize administrator account.' });
  }
});

app.post('/api/admin/login', adminLimiter, (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      res.status(400).json({ error: 'Administrator email and password are required.' });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const envEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const envPass = process.env.ADMIN_PASSCODE?.trim();

    if (envEmail && envPass && normalizedEmail === envEmail) {
      const a = Buffer.from(password);
      const b = Buffer.from(envPass);
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        logAudit(null, normalizedEmail, 'ADMIN_LOGIN_FAILED', 'auth', '', 'Invalid environment passcode');
        res.status(401).json({ error: 'Access denied: Invalid administrator credentials.' });
        return;
      }
      let adminUser = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail) as
        | Record<string, unknown>
        | undefined;
      const now = new Date().toISOString();
      if (!adminUser) {
        const uid = crypto.randomUUID();
        const { hash, salt } = hashPassword(crypto.randomBytes(24).toString('hex'));
        db.prepare(`
          INSERT INTO users (
            uid, full_name, email, phone, institution, country, user_category,
            role, status, profile_image, email_verified, verification_token,
            password_hash, password_salt, last_login_at, created_at, updated_at
          ) VALUES (?, 'System Administrator', ?, '', 'eDNA BioScope Operations', 'Global', 'Scientist', 'admin', 'active', '', 1, '', ?, ?, ?, ?, ?)
        `).run(uid, normalizedEmail, hash, salt, now, now, now);
        adminUser = db.prepare('SELECT * FROM users WHERE uid = ?').get(uid) as Record<string, unknown>;
      } else {
        db.prepare("UPDATE users SET role = 'admin', last_login_at = ?, updated_at = ? WHERE uid = ?").run(
          now,
          now,
          String(adminUser.uid)
        );
      }
      logAudit(String(adminUser.uid), normalizedEmail, 'ADMIN_LOGIN_SUCCESS', 'auth', String(adminUser.uid), 'Authenticated via server admin credentials');
      const token = signSessionToken({ uid: String(adminUser.uid), email: normalizedEmail, role: 'admin' });
      res.json({ token, user: sanitizeUser(adminUser) });
      return;
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail) as
      | Record<string, unknown>
      | undefined;
    if (!user || !verifyPassword(password, String(user.password_hash), String(user.password_salt))) {
      logAudit(null, normalizedEmail, 'ADMIN_LOGIN_FAILED', 'auth', '', 'Invalid email or password');
      res.status(401).json({ error: 'Access denied: Invalid administrator credentials.' });
      return;
    }
    if (user.role !== 'admin') {
      logAudit(String(user.uid), normalizedEmail, 'ADMIN_ROLE_DENIED', 'auth', String(user.uid), 'Non-admin user attempted admin login');
      res.status(403).json({ error: 'Access denied: This account does not hold administrator privileges.' });
      return;
    }
    if (user.status !== 'active') {
      res.status(403).json({ error: 'Access denied: Administrator account is suspended.' });
      return;
    }

    const now = new Date().toISOString();
    db.prepare('UPDATE users SET last_login_at = ?, updated_at = ? WHERE uid = ?').run(now, now, String(user.uid));
    logAudit(String(user.uid), normalizedEmail, 'ADMIN_LOGIN_SUCCESS', 'auth', String(user.uid), 'Authenticated to secure control center');

    const token = signSessionToken({ uid: String(user.uid), email: normalizedEmail, role: 'admin' });
    res.json({ token, user: sanitizeUser({ ...user, last_login_at: now }) });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ error: 'Administrator authentication error.' });
  }
});

app.get('/api/admin/overview', adminLimiter, requireAdmin, (_req, res) => {
  const totalUsers = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;
  const activeUsers = (db.prepare("SELECT COUNT(*) as c FROM users WHERE status = 'active'").get() as { c: number }).c;
  const totalDatasets = (db.prepare('SELECT COUNT(*) as c FROM datasets').get() as { c: number }).c;
  const completedJobs = (db.prepare("SELECT COUNT(*) as c FROM analysis_jobs WHERE status = 'completed'").get() as { c: number }).c;
  const failedJobs = (db.prepare("SELECT COUNT(*) as c FROM analysis_jobs WHERE status = 'failed'").get() as { c: number }).c;
  const totalSpeciesRef = (db.prepare('SELECT COUNT(*) as c FROM species_reference').get() as { c: number }).c;
  const totalTaxaIdentified = (db.prepare('SELECT COUNT(*) as c FROM taxonomic_results').get() as { c: number }).c;

  const users = db
    .prepare(
      'SELECT uid, full_name, email, phone, institution, country, user_category, role, status, email_verified, last_login_at, created_at FROM users ORDER BY created_at DESC'
    )
    .all();

  const datasets = db
    .prepare(`
      SELECT d.*, u.full_name AS owner_name, u.email AS owner_email, b.species_richness, b.shannon_index
      FROM datasets d
      INNER JOIN users u ON u.uid = d.user_id
      LEFT JOIN biodiversity_metrics b ON b.dataset_id = d.id
      ORDER BY d.created_at DESC LIMIT 100
    `)
    .all();

  const jobs = db
    .prepare(`
      SELECT j.*, d.dataset_name, u.email AS owner_email
      FROM analysis_jobs j
      INNER JOIN datasets d ON d.id = j.dataset_id
      INNER JOIN users u ON u.uid = j.user_id
      ORDER BY j.started_at DESC LIMIT 100
    `)
    .all();

  const activities = db
    .prepare(`
      SELECT a.*, u.email AS user_email, u.full_name AS user_name
      FROM user_activity a
      LEFT JOIN users u ON u.uid = a.uid
      ORDER BY a.timestamp DESC LIMIT 60
    `)
    .all();

  const auditLogs = db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 60').all();
  const speciesReference = db.prepare('SELECT * FROM species_reference ORDER BY scientific_name ASC').all();
  const learningModules = db.prepare('SELECT * FROM learning_modules ORDER BY order_index ASC').all();

  res.json({
    stats: {
      totalUsers,
      activeUsers,
      totalDatasets,
      completedJobs,
      failedJobs,
      totalSpeciesRef,
      totalTaxaIdentified,
    },
    integrations: {
      localSqlite: { status: 'connected', engine: 'Node SQLite (Relational Store)' },
      supabase: getSupabaseStatus(),
      firebase: {
        configured: Boolean(process.env.VITE_FIREBASE_API_KEY?.trim() && process.env.VITE_FIREBASE_PROJECT_ID?.trim()),
      },
      ncbiExternalBlast: {
        configured: Boolean(process.env.NCBI_API_KEY?.trim() || process.env.EXTERNAL_BLAST_ENDPOINT?.trim()),
      },
      smtpEmail: {
        configured: Boolean(process.env.SMTP_HOST?.trim()),
      },
    },
    users,
    datasets,
    jobs,
    activities,
    auditLogs,
    speciesReference,
    learningModules,
  });
});

app.patch('/api/admin/users/:uid/status', adminLimiter, requireAdmin, (req: AuthenticatedRequest, res) => {
  const targetUid = req.params.uid;
  const { status } = req.body || {};
  if (!['active', 'suspended'].includes(status)) {
    res.status(400).json({ error: 'Status must be "active" or "suspended".' });
    return;
  }
  if (targetUid === req.authUser!.uid && status === 'suspended') {
    res.status(400).json({ error: 'Cannot suspend your own active administrator account.' });
    return;
  }
  const target = db.prepare('SELECT uid, email FROM users WHERE uid = ?').get(targetUid) as
    | { uid: string; email: string }
    | undefined;
  if (!target) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }
  db.prepare('UPDATE users SET status = ?, updated_at = ? WHERE uid = ?').run(
    status,
    new Date().toISOString(),
    targetUid
  );
  logAudit(
    req.authUser!.uid,
    req.authUser!.email,
    status === 'suspended' ? 'USER_SUSPENDED' : 'USER_REACTIVATED',
    'user',
    targetUid,
    `Set account status for ${target.email} to ${status}`
  );
  res.json({ message: `User account ${status}.` });
});

app.post('/api/admin/species', adminLimiter, requireAdmin, (req: AuthenticatedRequest, res) => {
  try {
    const body = req.body || {};
    const required = ['scientific_name', 'common_name', 'kingdom', 'phylum', 'class_name', 'order_name', 'family', 'genus', 'species', 'organism_category', 'marker_gene', 'reference_database', 'accession_id', 'habitat', 'conservation_status', 'reference_motif', 'description'];
    for (const k of required) {
      if (!body[k] || typeof body[k] !== 'string' || !body[k].trim()) {
        res.status(400).json({ error: `Field "${k}" is required.` });
        return;
      }
    }
    const id = `sp-${crypto.randomBytes(4).toString('hex')}`;
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO species_reference (
        id, scientific_name, common_name, kingdom, phylum, class_name, order_name,
        family, genus, species, organism_category, marker_gene, reference_database,
        accession_id, habitat, conservation_status, reference_motif, description, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      body.scientific_name.trim(),
      body.common_name.trim(),
      body.kingdom.trim(),
      body.phylum.trim(),
      body.class_name.trim(),
      body.order_name.trim(),
      body.family.trim(),
      body.genus.trim(),
      body.species.trim(),
      body.organism_category.trim(),
      body.marker_gene.trim(),
      body.reference_database.trim(),
      body.accession_id.trim(),
      body.habitat.trim(),
      body.conservation_status.trim(),
      body.reference_motif.trim().toUpperCase(),
      body.description.trim(),
      now
    );
    logAudit(req.authUser!.uid, req.authUser!.email, 'SPECIES_ADDED', 'species_reference', id, `Added ${body.scientific_name}`);
    res.status(201).json({ id, message: 'Species reference record created.' });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to create species record.' });
  }
});

app.delete('/api/admin/species/:id', adminLimiter, requireAdmin, (req: AuthenticatedRequest, res) => {
  const id = req.params.id;
  db.prepare('DELETE FROM species_reference WHERE id = ?').run(id);
  logAudit(req.authUser!.uid, req.authUser!.email, 'SPECIES_DELETED', 'species_reference', id, 'Removed species reference entry');
  res.json({ message: 'Species removed.' });
});

app.patch('/api/admin/learning/:id', adminLimiter, requireAdmin, (req: AuthenticatedRequest, res) => {
  const id = req.params.id;
  const { title, summary, content, key_formula, published } = req.body || {};
  const existing = db.prepare('SELECT * FROM learning_modules WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Learning module not found.' });
    return;
  }
  db.prepare(
    'UPDATE learning_modules SET title = ?, summary = ?, content = ?, key_formula = ?, published = ?, updated_at = ? WHERE id = ?'
  ).run(
    typeof title === 'string' && title.trim() ? title.trim() : String(existing.title),
    typeof summary === 'string' && summary.trim() ? summary.trim() : String(existing.summary),
    typeof content === 'string' && content.trim() ? content.trim() : String(existing.content),
    typeof key_formula === 'string' ? key_formula.trim() : String(existing.key_formula),
    typeof published === 'boolean' ? (published ? 1 : 0) : Number(existing.published),
    new Date().toISOString(),
    id
  );
  logAudit(req.authUser!.uid, req.authUser!.email, 'LEARNING_UPDATED', 'learning_modules', id, 'Updated educational module');
  res.json({ message: 'Learning module updated.' });
});

app.post('/api/admin/learning', adminLimiter, requireAdmin, (req: AuthenticatedRequest, res) => {
  const { title, category, summary, content, key_formula = '' } = req.body || {};
  if (!title || !category || !summary || !content) {
    res.status(400).json({ error: 'Title, category, summary, and content are required.' });
    return;
  }
  const id = `mod-${crypto.randomBytes(4).toString('hex')}`;
  const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 48)}-${id}`;
  const maxOrder = (db.prepare('SELECT COALESCE(MAX(order_index), 0) as m FROM learning_modules').get() as { m: number }).m;
  db.prepare(
    'INSERT INTO learning_modules (id, slug, title, category, summary, content, key_formula, order_index, published, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)'
  ).run(id, slug, title.trim(), category.trim(), summary.trim(), content.trim(), String(key_formula).trim(), maxOrder + 1, new Date().toISOString());
  logAudit(req.authUser!.uid, req.authUser!.email, 'LEARNING_CREATED', 'learning_modules', id, `Created module ${title}`);
  res.status(201).json({ id, message: 'Educational module created.' });
});

// ---------- SERVER BOOTSTRAP (VITE DEV OR STATIC DIST) ----------

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`eDNA BioScope server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
