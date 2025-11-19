# Peek - AI-Powered Task Manager

A beautiful, Linear-inspired task manager built with Electron, React, and AI capabilities powered by Google Gemini.

![Peek Task Manager](https://img.shields.io/badge/Electron-28.1.0-47848F?logo=electron)
![React](https://img.shields.io/badge/React-18.2.0-61DAFB?logo=react)
![Vite](https://img.shields.io/badge/Vite-5.0-646CFF?logo=vite)

## Features

✨ **Beautiful UI** - Glassmorphic design with smooth animations powered by Framer Motion
⌨️ **Keyboard-First** - Navigate and manage tasks entirely with keyboard shortcuts
🤖 **AI-Powered** - Break down tasks and smart prioritization using Google Gemini
📊 **Smart Organization** - Focus mode, backlog, and archive views
💾 **Local Storage** - All your data stored locally in your browser
🎯 **Natural Language** - Add tasks with dates and times in plain English

## Screenshots

The app features:
- Clean, dark-themed interface
- Real-time task detection (dates, times, priorities)
- Keyboard navigation with visual indicators
- AI-powered task breakdown
- Smart task prioritization
- Archive/history view

## Installation

### Prerequisites

- Node.js 18+ and npm
- Google Gemini API key ([Get one here](https://makersuite.google.com/app/apikey))

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Peek
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure your API key**

   The app needs a Gemini API key for AI features. You can set it in one of two ways:

   **Option 1: Environment Variable (Recommended for Development)**
   ```bash
   export GEMINI_API_KEY="your-api-key-here"
   ```

   **Option 2: Modify the code (Quick Test)**

   Open `src/App.jsx` and update line 26:
   ```javascript
   let apiKey = "your-api-key-here";
   ```

## Usage

### Development Mode

Run the app in development mode with hot reload:

```bash
npm run electron:dev
```

This will:
1. Start the Vite dev server on http://localhost:5173
2. Launch the Electron app
3. Enable hot module replacement (HMR)

### Building for Production

Build the app for your platform:

```bash
npm run electron:build
```

The built app will be in the `dist` folder.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘/Ctrl + K` | Focus search/input |
| `Enter` | Add new task |
| `↑/↓` | Navigate tasks |
| `Space` | Toggle task completion |
| `Delete/Backspace` | Archive task |
| `Esc` | Return to input |

## Natural Language Task Creation

Add tasks with natural language parsing:

- `"Call John at 2pm"` → Task with time
- `"Review PR tomorrow"` → Task due tomorrow
- `"Fix urgent bug today"` → High priority task due today
- `"Meeting next week"` → Task for next week

## AI Features

### Task Breakdown
Click the "Break Down" button or "AI" badge on any task to automatically generate 3 relevant subtasks using Google Gemini.

### Smart Prioritize
Click "Smart Prioritize" in the footer to have AI reorganize your tasks based on urgency and importance.

## Project Structure

```
Peek/
├── electron/          # Electron main process
│   ├── main.js       # Main process entry
│   └── preload.js    # Preload script for IPC
├── src/              # React application
│   ├── App.jsx       # Main app component
│   ├── main.jsx      # React entry point
│   └── index.css     # Global styles
├── public/           # Static assets
├── index.html        # HTML template
├── vite.config.js    # Vite configuration
├── tailwind.config.js # Tailwind CSS config
└── package.json      # Dependencies and scripts
```

## Technology Stack

- **Electron** - Desktop app framework
- **React** - UI library
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first CSS
- **Framer Motion** - Animation library
- **Lucide React** - Icon library
- **Google Gemini** - AI capabilities

## Configuration

### Electron Window Settings

Edit `electron/main.js` to customize:
- Window size and position
- Title bar style (hiddenInset for macOS)
- Vibrancy effects
- DevTools behavior

### Tailwind Theme

Edit `tailwind.config.js` to customize colors, fonts, and other design tokens.

## Development Tips

1. **Hot Reload**: Changes to React components will hot reload automatically
2. **DevTools**: Press `Cmd/Ctrl + Shift + I` to open Chrome DevTools
3. **Debugging Main Process**: Add `console.log()` in `electron/main.js` - output appears in terminal
4. **Debugging Renderer**: Use Chrome DevTools for React debugging

## Troubleshooting

### Electron won't download during install
If you see 403 errors when installing Electron, try:
```bash
npm cache clean --force
npm install
```

### API key not working
Make sure your Gemini API key is valid and has the Generative Language API enabled.

### Tasks not persisting
Check browser console for localStorage errors. Make sure localStorage is enabled in your browser.

## Future Enhancements

Potential features to add:
- [ ] Cloud sync
- [ ] Multiple project workspaces
- [ ] Task tags and filters
- [ ] Recurring tasks
- [ ] Time tracking
- [ ] Export to other formats
- [ ] Collaborative features
- [ ] Mobile companion app

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - feel free to use this project for personal or commercial purposes.

## Credits

- Design inspired by [Linear](https://linear.app)
- Built with ❤️ using modern web technologies
