// Central place for settings read from the environment (.env locally, secrets/vars in CI),
// so tests never hard-code URLs or secrets. Empty values count as "not set".
const env = (name: string, fallback = '') => process.env[name] || fallback;

// Target site. No real default on purpose: point these at your own environment in .env (see .env.example).
export const BASE_URL = env('BASE_URL', 'https://shop.example.com');
export const API = env('API_URL', 'https://api.shop.example.com/api/v1');

/** Mailbox the suite reads verification emails from (any IMAP provider). See README, "Mailbox setup". */
export const mail = {
  host: env('MAIL_HOST'),
  port: Number(env('MAIL_PORT', '993')),
  user: env('MAIL_USER'),
  password: env('MAIL_PASSWORD'),
  /** Address the "+alias" is added to, e.g. qa@example.com gives qa+pw123@example.com. Defaults to MAIL_USER. */
  addressBase: env('MAIL_ADDRESS_BASE') || env('MAIL_USER'),
};
/** Subject of the verification email to wait for. */
export const VERIFY_EMAIL_SUBJECT = env('VERIFY_EMAIL_SUBJECT', 'Verify your email');
export const mailConfigured = Boolean(mail.host && mail.user && mail.password && mail.addressBase);

/** Optional pre-verified QA customer (with address and onboarding done), used when no mailbox is set. */
export const TEST_EMAIL = env('TEST_EMAIL');
export const TEST_PASSWORD = env('TEST_PASSWORD');

// Delivery-zone fixtures of the environment under test: a zone id plus one point inside and one outside it.
// Read from .env (ZONE_IN_*, ZONE_OUT_*); the coordinate defaults are only sample values.
export const ZONE_IN_ID = env('ZONE_IN_ID', '00000000-0000-4000-8000-0000000000aa');
export const ZONE_IN_NAME = env('ZONE_IN_NAME', 'Zone A');
export const IN_ZONE = { lat: Number(env('ZONE_IN_LAT', '53.3881')), lng: Number(env('ZONE_IN_LNG', '-6.377')) };
export const OUT_OF_ZONE = { lat: Number(env('ZONE_OUT_LAT', '30.008')), lng: Number(env('ZONE_OUT_LNG', '31.211')) };
/** Sample address used when a test creates an address; the postal code must be valid for the shop's market. */
export const SAMPLE_ADDRESS = {
  addressLine: env('SAMPLE_ADDRESS_LINE', '1 Main St'),
  city: env('SAMPLE_CITY', 'Dublin'),
  country: env('SAMPLE_COUNTRY', 'Ireland'),
  postalCode: env('SAMPLE_POSTAL_CODE', 'D15 X2R4'),
};
export const UNKNOWN_UUID = '00000000-0000-4000-8000-000000000000';

export const NO_ACCOUNT_REASON =
  'No test account: set the MAIL_* variables (fresh account per run) or TEST_EMAIL/TEST_PASSWORD (see README)';
