import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { TIMEZONE } from '../config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, 'coach.db');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS daily_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    log_date TEXT UNIQUE NOT NULL,
    career_status TEXT NOT NULL,
    fitness_status TEXT NOT NULL,
    cleanliness_status TEXT NOT NULL,
    social_status TEXT DEFAULT NULL
  );

  CREATE TABLE IF NOT EXISTS user_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    streak_shields INTEGER DEFAULT 0,
    consecutive_days_perfect INTEGER DEFAULT 0,
    is_vacation_until TEXT DEFAULT NULL,
    is_lowpower_today INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS milestones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    logged_at TEXT NOT NULL,
    category TEXT NOT NULL,
    val TEXT NOT NULL
  );
`);

const settingsCount = db.prepare('SELECT COUNT(*) as count FROM user_settings').get();
if (settingsCount.count === 0) {
  db.prepare('INSERT INTO user_settings DEFAULT VALUES').run();
}

export function getTodayDateStr() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(new Date());
}

function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

export function getTodayLog() {
  return getLogByDate(getTodayDateStr());
}

export function getLogByDate(date) {
  return db.prepare('SELECT * FROM daily_logs WHERE log_date = ?').get(date) ?? null;
}

export function saveDailyLog({ logDate, careerStatus, fitnessStatus, cleanlinessStatus, socialStatus = null }) {
  const stmt = db.prepare(`
    INSERT INTO daily_logs (log_date, career_status, fitness_status, cleanliness_status, social_status)
    VALUES (@logDate, @careerStatus, @fitnessStatus, @cleanlinessStatus, @socialStatus)
    ON CONFLICT(log_date) DO UPDATE SET
      career_status = @careerStatus,
      fitness_status = @fitnessStatus,
      cleanliness_status = @cleanlinessStatus,
      social_status = @socialStatus
  `);
  stmt.run({ logDate, careerStatus, fitnessStatus, cleanlinessStatus, socialStatus });
}

export function getSettings() {
  return db.prepare('SELECT * FROM user_settings WHERE id = 1').get();
}

export function updateSettings(partial) {
  const allowed = ['streak_shields', 'consecutive_days_perfect', 'is_vacation_until', 'is_lowpower_today'];
  const entries = Object.entries(partial).filter(([key]) => allowed.includes(key));
  if (entries.length === 0) return getSettings();

  const setClause = entries.map(([key]) => `${key} = @${key}`).join(', ');
  const params = Object.fromEntries(entries);
  db.prepare(`UPDATE user_settings SET ${setClause} WHERE id = 1`).run(params);
  return getSettings();
}

export function addMilestone(category, val) {
  db.prepare('INSERT INTO milestones (logged_at, category, val) VALUES (?, ?, ?)').run(
    new Date().toISOString(),
    category,
    val
  );
}

export function getLogsSince(sinceDate) {
  return db.prepare('SELECT * FROM daily_logs WHERE log_date >= ? ORDER BY log_date ASC').all(sinceDate);
}

export function getLogsLastNDays(n) {
  const sinceDate = addDays(getTodayDateStr(), -(n - 1));
  return getLogsSince(sinceDate);
}

export function getDaysSinceLastLog() {
  const last = db.prepare('SELECT log_date FROM daily_logs ORDER BY log_date DESC LIMIT 1').get();
  if (!last) return 0;

  const today = getTodayDateStr();
  const [ty, tm, td] = today.split('-').map(Number);
  const [ly, lm, ld] = last.log_date.split('-').map(Number);
  const todayMs = Date.UTC(ty, tm - 1, td);
  const lastMs = Date.UTC(ly, lm - 1, ld);
  return Math.floor((todayMs - lastMs) / 86400000);
}

export function isOnVacation(today = getTodayDateStr()) {
  const settings = getSettings();
  if (!settings.is_vacation_until) return false;
  return today <= settings.is_vacation_until;
}

export function isInResurrectionMode() {
  return getDaysSinceLastLog() >= 4;
}

export function getYesterdayDateStr() {
  return addDays(getTodayDateStr(), -1);
}

export { db, addDays };
