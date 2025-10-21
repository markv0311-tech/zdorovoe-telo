# Deployment Guide for Здоровое тело Telegram Mini App

## Quick Start

### 1. Local Development
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Open in browser
open http://localhost:3000
```

### 2. Test Mode
Open `test.html` in your browser to test the app without Telegram integration.

## Deployment Options

### Option 1: Vercel (Recommended)
1. Install Vercel CLI: `npm i -g vercel`
2. Run: `vercel`
3. Follow the prompts
4. Your app will be deployed at `https://your-app.vercel.app`

### Option 2: Heroku
1. Create a Heroku app
2. Connect to your GitHub repository
3. Deploy automatically

### Option 3: Railway
1. Connect your GitHub repository
2. Deploy with one click

### Option 4: Netlify
1. Connect your repository
2. Set build command: `npm start`
3. Deploy

## Telegram Bot Setup

### 1. Create Bot
1. Message @BotFather on Telegram
2. Use `/newbot` command
3. Follow the instructions
4. Save the bot token

### 2. Configure Web App
1. Use `/newapp` command with @BotFather
2. Select your bot
3. Set the Web App URL to your deployed app URL
4. Upload app icon and description

### 3. Add Menu Button
Use this command with @BotFather:
```
/setmenubutton
```
Then select your bot and set the button text to "Открыть приложение".

## Environment Variables

Create a `.env` file for production:
```
NODE_ENV=production
PORT=3000
```

## Testing

### Local Testing
1. Start the server: `npm start`
2. Open `test.html` in your browser
3. Test all features

### Telegram Testing
1. Deploy the app
2. Open the bot in Telegram
3. Click the menu button
4. Test all functionality

## Features Implemented

✅ **Home Page**
- Full-screen hero image
- Greeting text and headline
- Navigation button to exercises

✅ **Reports Section**
- Interactive calendar
- Day completion tracking
- Progress statistics
- Visual streak counter

✅ **Exercises Section**
- 8 different program blocks
- Expandable program details
- 10-day exercise modules
- Video integration
- Exercise descriptions

✅ **Profile Section**
- User information management
- Subscription status display
- Editable profile fields
- Data persistence

✅ **Subscription System**
- Access control
- Expiration handling
- Renewal interface
- Backend integration

✅ **Technical Features**
- Telegram WebApp API integration
- Responsive mobile-first design
- Local storage + API sync
- Error handling
- Loading states

## API Endpoints

- `GET /api/user/:userId/profile` - Get user profile
- `POST /api/user/:userId/profile` - Update user profile
- `GET /api/user/:userId/subscription` - Get subscription status
- `POST /api/user/:userId/subscription` - Create/update subscription
- `GET /api/user/:userId/progress` - Get user progress
- `POST /api/user/:userId/progress` - Save progress

## Troubleshooting

### Common Issues

1. **Telegram WebApp not loading**
   - Check if the app URL is accessible
   - Verify HTTPS is enabled
   - Check browser console for errors

2. **API calls failing**
   - Ensure server is running
   - Check CORS settings
   - Verify API endpoints

3. **Data not persisting**
   - Check localStorage in browser dev tools
   - Verify API responses
   - Check network tab for failed requests

### Debug Mode

Add `?debug=1` to the URL to enable debug logging:
```
https://your-app.com?debug=1
```

## Support

For issues and questions:
1. Check the browser console for errors
2. Verify all files are properly deployed
3. Test with the test.html file first
4. Check the README.md for detailed setup instructions
