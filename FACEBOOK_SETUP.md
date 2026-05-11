# Facebook OAuth Configuration Guide

## The Error You're Seeing

When connecting Facebook, you're getting an **"ERR_INVALID_REDIRECT"** error. This happens because the redirect URI in your Facebook app settings doesn't match what's configured in the code.

## How to Fix It

Follow these steps to properly configure your Facebook app:

### Step 1: Go to Facebook Developer Console
1. Open https://developers.facebook.com
2. Log in with your Facebook account
3. Go to "My Apps" and select your app (App ID: `1949048649331279`)

### Step 2: Configure OAuth Redirect URI
1. In the left sidebar, click **Settings** > **Basic**
2. Copy your **App ID** and **App Secret**
3. In the left sidebar, click **Settings** > **Basic**
4. Scroll down to "App Domains" - add: `localhost`

### Step 3: Add Valid OAuth Redirect URIs
1. In the left sidebar, go to **Products** > **Facebook Login** > **Settings**
2. Look for "Valid OAuth Redirect URIs"
3. Add this exact URI:
   ```
   http://localhost:5001/api/admin/facebook/oauth/callback
   ```
4. **Save Changes**

### Step 4: Update Your .env File
Edit: `backend/.env`

Replace these lines with your actual credentials:
```
FACEBOOK_CLIENT_ID=<YOUR_APP_ID_HERE>
FACEBOOK_CLIENT_SECRET=<YOUR_APP_SECRET_HERE>
FACEBOOK_REDIRECT_URI=http://localhost:5001/api/admin/facebook/oauth/callback
```

Where:
- `<YOUR_APP_ID_HERE>` = Your Facebook App ID (from Developer Console)
- `<YOUR_APP_SECRET_HERE>` = Your App Secret (from Developer Console)
- Redirect URI stays as: `http://localhost:5001/api/admin/facebook/oauth/callback`

### Step 5: Restart the Backend Server
1. Stop the backend server (Ctrl+C in the terminal)
2. Run again:
   ```
   cd backend
   npm run dev
   ```

### Step 6: Test Connection
1. Go to http://localhost:5173
2. Navigate to Facebook page
3. Click "Connect Facebook Account"
4. You should now be able to authorize successfully

## Troubleshooting

**Still getting ERR_INVALID_REDIRECT?**
- Make sure the redirect URI in Facebook Developer Console **exactly** matches:
  - `http://localhost:5001/api/admin/facebook/oauth/callback`
- Check for trailing slashes, HTTPS vs HTTP, capitalization
- Wait a few seconds after saving changes in Facebook console

**Getting ERR_CLIENT_ID or ERR_SECRET?**
- Double-check you copied the correct App ID and App Secret
- Make sure they're in the `.env` file with no extra spaces

**Getting "Failed to fetch Facebook profile"?**
- Your access token might be expired
- Try disconnecting and reconnecting your account

## Permissions Required

When connecting, Facebook will ask for these permissions:
- `email` - to get your email address
- `public_profile` - to get your name and photo
- `pages_read_engagement` - to view page engagement
- `pages_read_user_content` - to read page content
- `pages_manage_posts` - to publish posts to your page
- `pages_show_list` - to see your pages

These are required to post photos/videos to your Facebook pages.

## Current Configuration in .env

```
FACEBOOK_CLIENT_ID=1949048649331279
FACEBOOK_CLIENT_SECRET=4dd04bf4aae0ab2098299738fbd5b4fb
FACEBOOK_REDIRECT_URI=http://localhost:5001/api/admin/facebook/oauth/callback
```

**⚠️ Important:** These are test credentials. Replace them with your own App ID and Secret from Facebook Developer Console.

## What Endpoints Are Available?

Once connected, you can:
- **POST** `/api/admin/facebook/posts` - Publish text/photo/video posts
- **GET** `/api/admin/facebook/pages` - Get list of your pages
- **GET** `/api/admin/facebook/posts` - Get post history
- **GET** `/api/admin/facebook/status` - Check connection status
- **GET** `/api/admin/facebook/stats` - Get engagement stats
- **POST** `/api/admin/facebook/disconnect` - Disconnect your account

## File Size Limits

- **Photos**: Any format (JPEG, PNG, GIF, WebP)
- **Videos**: Up to 500MB (MP4, WebM, MOV)

## Need Help?

If you're still having issues:
1. Check the Terminal output for detailed error messages
2. Make sure your app is in **Development** mode in Facebook (not Production)
3. Verify all credentials are correct in `.env` file
4. Try with a test account first before using your main account
