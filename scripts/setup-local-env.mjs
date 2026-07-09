import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const recaptchaTestKey = ['6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ', '_MXjiZKhI'].join('');
const localJwtSecret = ['dev', 'jwt', 'secret', 'change', 'me'].join('_');
const files = [
  {
    target: path.join(root, '.env'),
    content: `VITE_RECAPTCHA_SITE_KEY=${recaptchaTestKey}
VITE_API_URL=http://localhost:4000/graphql
VITE_API_WS=ws://localhost:4000/graphql
VITE_MAPBOX_TOKEN=your_mapbox_token_here
VITE_DEV_BIND_HOST=127.0.0.1
VITE_DEV_HOST=localhost
VITE_DEV_PORT=5173
VITE_DEV_ORIGIN=http://localhost:5173
VITE_DEV_HMR_PROTOCOL=ws
VITE_DEV_HMR_CLIENT_PORT=5173
VITE_DEV_ALLOWED_HOSTS=localhost
`,
  },
  {
    target: path.join(root, 'cohan-restaurant-backend/.env'),
    content: `NODE_ENV=development
PORT=4000
HOST=0.0.0.0
LOG_LEVEL=debug
JWT_SECRET=${localJwtSecret}
JWT_EXPIRES_IN=7d
JWT_ISSUER=cohan-system
MONGO_URI=mongodb://127.0.0.1:27017/RestaurantDB?replicaSet=rs0
MONGO_DB=RestaurantDB
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:4000
RL_GLOBAL_MAX=200
RL_GLOBAL_WINDOW=1 minute
RL_AUTH_MAX=12
RL_AUTH_WINDOW=1 minute
RL_BAN=0
GRAPHQL_GRAPHIQL=true
GRAPHQL_INTROSPECTION=true
ENABLE_RECAPTCHA=false
RECAPTCHA_SECRET=replace_with_recaptcha_secret
ENABLE_EMAIL_VERIFICATION=false
APP_PUBLIC_URL=http://localhost:5173
ENABLE_PASSWORD_POLICY=true
SMTP_USER=your-email@example.com
SMTP_PASS=replace_with_smtp_app_password
MAIL_FROM="Cohan <no-reply@foodhub.local>"
UPLOAD_DIR=./uploads
UPLOAD_MAX_BYTES=5242880
UPLOAD_ALLOWED_MIME=image/jpeg,image/png,image/webp,image/avif
UPLOAD_TO_WEBP=true
PUBLIC_BASE_URL=http://localhost:4000
`,
  },
];

for (const file of files) {
  if (fs.existsSync(file.target)) {
    console.log(`⏭️  Skip existing: ${path.relative(root, file.target)}`);
    continue;
  }
  fs.writeFileSync(file.target, file.content, 'utf8');
  console.log(`✅ Created: ${path.relative(root, file.target)}`);
}

console.log('\nDone. Edit secrets in .env files before production use.');