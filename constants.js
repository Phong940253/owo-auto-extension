const CATCH_COMMAND_PREFIX = '@Pokétwo#8236 catch ';
const AUTO_HUNT_COMMAND = 'oh';
const AUTO_BATTLE_COMMAND = 'ob';
const AUTO_OPRAY_COMMAND = 'opray';
const AUTO_HUNT_TO_BATTLE_DELAY_MS = 450;
const AUTO_HUNT_INTERVAL_MIN_MS = 15_000;
const AUTO_HUNT_INTERVAL_MAX_MS = 25_000;
const AUTO_OPRAY_INTERVAL_MS = 330_000;
const DEFAULT_OWNER_USERNAME = 'phong940253aaa';
const VERIFY_ALERT_PHRASES = [
    'are you a real human',
    'verify that you are human',
    'complete your captcha',
    'please complete your captcha',
    'captcha to verify'
];
const VERIFY_BUTTON_KEYWORDS = ['verify'];
const VERIFY_MESSAGE_KEYWORDS = ['captcha', 'verify', 'human'];
const DEBUG_AUTO_STOP_TRIGGER_PHRASES = [
    '[auto-stop-test]',
    'autostop test',
    'stop auto test'
];
const VERIFY_STOP_NOTIFY_COOLDOWN_MS = 30_000;
const processedImageUrls = new Set();
const processedVerifyMessageIds = new Set();
const ALLOWED_BOT_NAMES = new Set(['poketwoverified appapp', '']);
var autoHuntTimeoutId = null;
var autoHuntButton = null;
var autoHuntStatus = null;
var autoCatchEnabled = true;
var autoCatchButton = null;
var autoCatchStatus = null;
var autoOprayIntervalId = null;
var autoOprayButton = null;
var autoOprayStatus = null;
var overlayPanel = null;
var allowDebugAutoStopFromAnyAuthor = true;
var lastAutoStopNotifiedAt = 0;
const notifiedVerifyMessageKeys = new Set();

