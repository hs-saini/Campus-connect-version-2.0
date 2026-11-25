const { neon } = require("@neondatabase/serverless");

let connection;
let schemaPromise;

function database() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured for this deployment.");
  }
  if (!connection) connection = neon(process.env.DATABASE_URL);
  return connection;
}

const defaultEvents = [
  { id:"tech-fest", title:"Annual Tech Fest", category:"Technology", date:"2026-12-05", time:"10:00", venue:"Main Auditorium", contact:"9876543210", email:"techfest@college.edu", description:"Coding challenges, project displays and technology talks.", fee:0 },
  { id:"music-evening", title:"Music Evening", category:"Cultural", date:"2026-12-12", time:"18:00", venue:"Open-Air Stage", contact:"9876543211", email:"culture@college.edu", description:"Live performances by students.", fee:0 },
  { id:"sports-day", title:"College Sports Day", category:"Sports", date:"2026-12-18", time:"09:00", venue:"College Ground", contact:"9876543212", email:"sports@college.edu", description:"Track events, games and friendly matches.", fee:0 }
];

async function initialize() {
  if (!schemaPromise) {
    const sql = database();
    schemaPromise = (async () => {
      await sql`CREATE SEQUENCE IF NOT EXISTS campus_student_code_seq`;
      await sql`
        CREATE TABLE IF NOT EXISTS students (
          id BIGINT PRIMARY KEY DEFAULT nextval('campus_student_code_seq'),
          student_code TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          roll_number TEXT NOT NULL,
          roll_normalized TEXT NOT NULL UNIQUE,
          email TEXT NOT NULL,
          email_normalized TEXT NOT NULL UNIQUE,
          phone TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await sql`
        CREATE TABLE IF NOT EXISTS events (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          template TEXT NOT NULL,
          category TEXT NOT NULL,
          owner_category TEXT NOT NULL,
          owner_admin_id TEXT NOT NULL,
          college TEXT NOT NULL,
          event_date DATE NOT NULL,
          event_time TEXT NOT NULL,
          venue TEXT NOT NULL,
          contact TEXT NOT NULL,
          email TEXT NOT NULL,
          description TEXT NOT NULL,
          fee NUMERIC(10,2) NOT NULL DEFAULT 0,
          qr TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await sql`
        CREATE TABLE IF NOT EXISTS admin_accounts (
          id BIGSERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT NOT NULL,
          email_normalized TEXT NOT NULL UNIQUE,
          admin_id TEXT NOT NULL,
          admin_id_normalized TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          category TEXT NOT NULL,
          phone TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('pending','approved','rejected','removed')),
          requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await sql`
        CREATE TABLE IF NOT EXISTS registrations (
          id BIGSERIAL PRIMARY KEY,
          event_id TEXT NOT NULL,
          event_title TEXT NOT NULL,
          student_pk BIGINT NOT NULL REFERENCES students(id),
          student_code TEXT NOT NULL,
          name TEXT NOT NULL,
          roll_number TEXT NOT NULL,
          email TEXT NOT NULL,
          phone TEXT NOT NULL,
          payment TEXT NOT NULL,
          proof TEXT NOT NULL DEFAULT '',
          pass_token TEXT NOT NULL UNIQUE,
          entered BOOLEAN NOT NULL DEFAULT FALSE,
          entry_time TIMESTAMPTZ,
          status TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT registrations_event_student_unique UNIQUE (event_id, student_pk)
        )`;
      await sql`
        CREATE TABLE IF NOT EXISTS login_rate_limits (
          bucket TEXT PRIMARY KEY,
          window_started TIMESTAMPTZ NOT NULL,
          attempts INTEGER NOT NULL
        )`;
      for (const event of defaultEvents) {
        await sql`
          INSERT INTO events
            (id, title, template, category, owner_category, owner_admin_id, college, event_date, event_time, venue, contact, email, description, fee)
          VALUES
            (${event.id}, ${event.title}, ${event.category}, ${event.category}, ${event.category}, 'master', 'CampusConnect College', ${event.date}, ${event.time}, ${event.venue}, ${event.contact}, ${event.email}, ${event.description}, ${event.fee})
          ON CONFLICT (id) DO NOTHING`;
      }
    })().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  await schemaPromise;
  return database();
}

module.exports = { initialize };
