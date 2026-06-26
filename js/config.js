/* ═══════════════════════════════════════════════════════════
   CONFIG.JS — Supabase credentials and shared constants
   Loaded first by both index.html and admin.html
   ═══════════════════════════════════════════════════════════ */

const SUPABASE_URL = 'https://racwcwugjhwyjtgvrmyc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJhY3djd3Vnamh3eWp0Z3ZybXljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwNjYzODksImV4cCI6MjA5NzY0MjM4OX0.AR4wsIIY4MfnmMh63QhVhKdE48HR3dI5P61cEV5RuaQ';

// Base URL for QR code generation — auto-detects local vs deployed
// Change to 'https://davenkuru.github.io/awm-attendance' when deploying
const SITE_URL = window.location.href.replace(/\/(admin|coordinator)\/[^/?#]*.*$/, '');

const THEME_KEY = 'awm_theme';
