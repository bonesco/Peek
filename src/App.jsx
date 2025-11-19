import React, { useState, useEffect, useRef } from 'react';
import {
  Check,
  Calendar,
  Clock,
  MoreHorizontal,
  GripVertical,
  Plus,
  Command,
  Search,
  Inbox,
  Zap,
  ArrowRight,
  Sparkles,
  Loader2,
  CornerDownRight,
  Layout,
  Target,
  History,
  X,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';

// --- GEMINI API SETUP ---
// API Key will be loaded from Electron's secure storage
let apiKey = "";

// Load API key from Electron if available
if (window.electronAPI) {
  window.electronAPI.getApiKey().then(key => {
    if (key) apiKey = key;
  });
}

// Helper for Gemini API calls with backoff
const callGemini = async (prompt, schemaType = "ARRAY") => {
  if (!apiKey) {
    console.warn('No API key configured. Please set your Gemini API key.');
    throw new Error('API key not configured');
  }

  const delays = [1000, 2000, 4000, 8000, 16000];

  for (let i = 0; i <= delays.length; i++) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: "application/json",
              responseSchema: schemaType === "ARRAY" ? {
                type: "ARRAY",
                items: { type: "STRING" }
              } : {
                type: "OBJECT",
                properties: {
                  sortedIds: { type: "ARRAY", items: { type: "STRING" } }
                }
              }
            }
          })
        }
      );

      if (!response.ok) throw new Error(`API Error: ${response.status}`);

      const data = await response.json();
      return JSON.parse(data.candidates[0].content.parts[0].text);
    } catch (error) {
      if (i === delays.length) throw error;
      await new Promise(resolve => setTimeout(resolve, delays[i]));
    }
  }
};

// --- MOCK DATA (Fallback) ---
const INITIAL_TASKS = [
  {
    id: '1',
    title: 'Review Q3 Design Specs',
    status: 'todo',
    due: 'Today',
    priority: 'High',
    project: 'Design',
    subtasks: [],
    archived: false
  },
  {
    id: '2',
    title: 'Sync with engineering team',
    status: 'todo',
    due: 'Tomorrow',
    priority: 'Medium',
    project: 'Core',
    subtasks: [],
    archived: false
  },
  {
    id: '3',
    title: 'Draft release notes for v2.4',
    status: 'todo',
    due: null,
    priority: 'Low',
    project: 'Marketing',
    subtasks: [],
    archived: false
  },
];

// Regex patterns
const TIME_PATTERNS = [
  /\b(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i,
  /\b(?:at\s+)(\d{1,2}(?::\d{2})?)\b/i,
];

const STATIC_KEYWORDS = {
  tomorrow: { label: 'Tomorrow', color: 'text-orange-400' },
  today: { label: 'Today', color: 'text-emerald-400' },
  urgent: { label: 'Urgent', color: 'text-red-500' },
  next_week: { label: 'Next Week', color: 'text-purple-400' },
};

// --- COMPONENTS ---

const LinearCheckbox = ({ checked, onChange, size = "md" }) => (
  <div
    onClick={(e) => { e.stopPropagation(); onChange(); }}
    className={`
      rounded-[4px] border cursor-pointer flex items-center justify-center transition-all duration-200
      ${size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4"}
      ${checked
        ? 'bg-indigo-500 border-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.4)]'
        : 'bg-white/5 border-white/10 hover:border-white/30'}
    `}
  >
    {checked && <Check size={size === "sm" ? 8 : 10} className="text-white stroke-[3]" />}
  </div>
);

const TagPill = ({ label, color, icon: Icon = Calendar }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.9 }}
    className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/5 border border-white/5 ${color} shadow-sm`}
  >
    <Icon size={10} />
    <span className="text-[10px] font-mono uppercase tracking-wider font-semibold">{label}</span>
  </motion.div>
);

export default function LinearCommandApp() {
  // LocalStorage Initialization
  const [tasks, setTasks] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('linear-tasks');
      if (saved) return JSON.parse(saved);
    }
    return INITIAL_TASKS;
  });

  useEffect(() => {
    localStorage.setItem('linear-tasks', JSON.stringify(tasks));
  }, [tasks]);

  const [inputValue, setInputValue] = useState("");
  const [detectedTags, setDetectedTags] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(new Set());
  const [isSorting, setIsSorting] = useState(false);
  const [viewMode, setViewMode] = useState('focus');
  const [selectedIndex, setSelectedIndex] = useState(-1); // -1 means input is focused

  const inputRef = useRef(null);
  const listRef = useRef(null);

  // --- PARSING LOGIC ---
  const parseInput = (text) => {
    const tags = [];
    let cleanText = text;
    Object.keys(STATIC_KEYWORDS).forEach(key => {
      if (cleanText.toLowerCase().includes(key.replace('_', ' '))) {
        tags.push(STATIC_KEYWORDS[key]);
      }
    });
    TIME_PATTERNS.forEach(pattern => {
      const match = text.match(pattern);
      if (match) {
        tags.push({ label: match[1].toUpperCase(), color: 'text-blue-400', icon: Clock });
      }
    });
    return { tags };
  };

  const extractMetadataAndClean = (text) => {
    let cleanText = text;
    let dueDate = null;
    let priority = 'Low';
    let extractedTime = null;

    Object.keys(STATIC_KEYWORDS).forEach(key => {
      const phrase = key.replace('_', ' ');
      const regex = new RegExp(`\\b${phrase}\\b`, 'i');
      if (regex.test(cleanText)) {
        cleanText = cleanText.replace(regex, "").trim();
        if (key === 'urgent') priority = 'High';
        else dueDate = STATIC_KEYWORDS[key].label;
      }
    });

    TIME_PATTERNS.forEach(pattern => {
      const match = cleanText.match(pattern);
      if (match) {
        cleanText = cleanText.replace(pattern, "").replace(/\s+/, " ").trim();
        extractedTime = match[1];
      }
    });

    const finalDue = extractedTime ? (dueDate ? `${dueDate} @ ${extractedTime}` : `Today @ ${extractedTime}`) : dueDate;
    return { cleanText, due: finalDue, priority };
  };

  useEffect(() => {
    const { tags } = parseInput(inputValue);
    setDetectedTags(tags);
  }, [inputValue]);

  // Filtering Logic (Need this before Keyboard Logic)
  const activeTasks = tasks.filter(t => !t.archived);
  const focusTasks = activeTasks.filter(t => (t.due && t.due.includes('Today')) || t.priority === 'High' || t.project === 'Inbox');
  const otherTasks = activeTasks.filter(t => !focusTasks.includes(t));
  const archivedTasks = tasks.filter(t => t.archived);

  let displayedTasks = [];
  if (viewMode === 'archive') {
      displayedTasks = archivedTasks;
  } else if (viewMode === 'focus') {
      displayedTasks = [...focusTasks, ...otherTasks];
  } else {
      displayedTasks = activeTasks;
  }

  // --- KEYBOARD NAVIGATION ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't navigate if we are typing in input (unless it's ArrowDown/Up to leave input)
      if (document.activeElement === inputRef.current) {
        if (e.key === 'ArrowDown') {
           e.preventDefault();
           if (displayedTasks.length > 0) {
             setSelectedIndex(0);
             inputRef.current.blur();
           }
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, displayedTasks.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (selectedIndex === 0) {
             setSelectedIndex(-1);
             inputRef.current.focus();
          } else {
             setSelectedIndex(prev => Math.max(prev - 1, 0));
          }
          break;
        case ' ': // Spacebar to toggle
          e.preventDefault();
          if (selectedIndex >= 0 && displayedTasks[selectedIndex]) {
            toggleTask(displayedTasks[selectedIndex].id);
          }
          break;
        case 'Backspace':
        case 'Delete':
           // Archive immediately
           if (selectedIndex >= 0 && displayedTasks[selectedIndex]) {
              const taskToArchive = displayedTasks[selectedIndex];
              setTasks(prev => prev.map(t => t.id === taskToArchive.id ? { ...t, archived: true } : t));
              // Adjust selection so we don't lose focus
              setSelectedIndex(prev => Math.min(prev, displayedTasks.length - 2));
           }
           break;
        case 'Escape':
           setSelectedIndex(-1);
           inputRef.current.focus();
           break;
        case 'k':
           if (e.metaKey || e.ctrlKey) {
             e.preventDefault();
             inputRef.current.focus();
           }
           break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, displayedTasks]);

  // Auto-scroll to selected item
  useEffect(() => {
    if (selectedIndex !== -1 && listRef.current) {
      const selectedElement = listRef.current.children[selectedIndex];
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  // --- ACTIONS ---
  const handleAddTask = (e) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      const { cleanText, due, priority } = extractMetadataAndClean(inputValue);
      const newTask = {
        id: Math.random().toString(36).substr(2, 9),
        title: cleanText,
        status: 'todo',
        due: due,
        priority,
        project: 'Inbox',
        subtasks: [],
        archived: false
      };
      setTasks([newTask, ...tasks]);
      setInputValue("");
    }
  };

  const toggleTask = (id) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    const isCompleting = task.status !== 'done';
    setTasks(tasks.map(t => t.id === id ? { ...t, status: isCompleting ? 'done' : 'todo' } : t));

    if (isCompleting) {
      setTimeout(() => {
        setTasks(currentTasks =>
          currentTasks.map(t => t.id === id ? { ...t, archived: true } : t)
        );
      }, 1200);
    }
  };

  const toggleSubtask = (parentId, subtaskId) => {
    setTasks(tasks.map(t => {
      if (t.id !== parentId) return t;
      return {
        ...t,
        subtasks: t.subtasks.map(st => st.id === subtaskId ? { ...st, status: st.status === 'done' ? 'todo' : 'done' } : st)
      };
    }));
  };

  const handleBreakDown = async (task) => {
    if (loadingTasks.has(task.id)) return;
    setLoadingTasks(prev => new Set(prev).add(task.id));
    try {
      const prompt = `You are a helpful project manager. Break down "${task.title}" into 3 concise subtasks. Return ONLY a JSON array of strings.`;
      const subtaskTitles = await callGemini(prompt, "ARRAY");
      if (Array.isArray(subtaskTitles)) {
        const newSubtasks = subtaskTitles.map(title => ({
          id: Math.random().toString(36).substr(2, 9),
          title: title,
          status: 'todo'
        }));
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, subtasks: [...t.subtasks, ...newSubtasks] } : t));
      }
    } catch (error) { console.error(error); }
    finally { setLoadingTasks(prev => { const next = new Set(prev); next.delete(task.id); return next; }); }
  };

  const handleSmartSort = async () => {
    if (isSorting || tasks.length < 2) return;
    setIsSorting(true);
    try {
      const taskList = tasks.filter(t => !t.archived).map(t => ({ id: t.id, title: t.title, due: t.due, priority: t.priority }));
      const prompt = `Sort these tasks by urgency/importance. High priority/Today is urgent. Return JSON object { "sortedIds": [] } based on IDs. Tasks: ${JSON.stringify(taskList)}`;
      const result = await callGemini(prompt, "OBJECT");
      if (result?.sortedIds) {
        const newOrder = [...tasks];
        newOrder.sort((a, b) => {
            if (a.archived || b.archived) return 0;
            const indexA = result.sortedIds.indexOf(a.id);
            const indexB = result.sortedIds.indexOf(b.id);
            return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
        });
        setTasks(newOrder);
      }
    } catch (error) { console.error(error); }
    finally { setIsSorting(false); }
  };

  return (
    <div className="min-h-screen w-full bg-[#050505] text-[#E0E0E0] font-sans selection:bg-indigo-500/30 flex flex-col items-center pt-[12vh]">

      {/* BACKGROUND */}
      <div className="fixed inset-0 pointer-events-none bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

      {/* MAIN CONTAINER */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[700px] bg-[#16181A]/80 backdrop-blur-2xl rounded-xl border border-white/[0.08] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6)] overflow-hidden relative z-10 ring-1 ring-white/5 flex flex-col max-h-[80vh]"
      >

        {/* HEADER */}
        <div className="relative border-b border-white/[0.06] bg-[#181A1D]/50 backdrop-blur-md z-20 flex-shrink-0">
          <div className="flex items-center px-4 h-14 gap-3">
            <div className={`transition-all duration-300 ${inputValue ? 'text-indigo-400 drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]' : selectedIndex === -1 ? 'text-white' : 'text-gray-500'}`}>
               {inputValue ? <Zap size={20} className="fill-indigo-500/20" /> : <Search size={20} />}
            </div>

            <input
              ref={inputRef}
              autoFocus
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleAddTask}
              placeholder={viewMode === 'archive' ? "Search archive..." : "Add a task (e.g. 'Call John at 2pm')..."}
              className="flex-1 bg-transparent text-[15px] placeholder-gray-600 text-gray-100 outline-none h-full font-normal tracking-tight"
            />

            <div className="flex gap-2">
              <AnimatePresence>
                {detectedTags.map((tag, i) => (
                  <TagPill key={i} label={tag.label} color={tag.color} icon={tag.icon} />
                ))}
              </AnimatePresence>

              {!inputValue && (
                <div className="flex items-center gap-1 text-[10px] font-medium text-gray-600 border border-white/[0.06] px-1.5 py-1 rounded bg-white/[0.02]">
                  <span className="font-mono text-xs">⌘</span>
                  <span>K</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* TASK LIST AREA */}
        <div className="flex-1 overflow-y-auto scrollbar-hide py-2 relative min-h-[300px]">

          <div className="px-5 py-3 flex justify-between items-center text-[10px] font-semibold text-gray-500 uppercase tracking-widest opacity-70 sticky top-0 bg-[#16181A]/95 backdrop-blur z-10">
             {viewMode === 'archive' ? (
                <div className="flex items-center gap-2 text-indigo-400">
                    <History size={12} />
                    <span>Archive</span>
                </div>
             ) : (
                <div className="flex items-center gap-2">
                    <Target size={12} />
                    <span>Focus</span>
                </div>
             )}
             <span>{viewMode === 'archive' ? `${archivedTasks.length} items` : `${displayedTasks.length} items`}</span>
          </div>

          {/* We use a ref for the container to handle scrollIntoView manually */}
          <div ref={listRef} className="px-2 pb-4">
            <AnimatePresence initial={false} mode='popLayout'>
              {displayedTasks.map((task, index) => {
                 const isBacklogStart = viewMode === 'focus' && index === focusTasks.length && focusTasks.length > 0;
                 const isSelected = index === selectedIndex;

                 return (
                  <React.Fragment key={task.id}>
                    {isBacklogStart && (
                        <motion.div layout className="px-3 py-4 mt-4 mb-2 text-[10px] font-semibold text-gray-600 uppercase tracking-widest flex items-center gap-2">
                            <Layout size={12} />
                            <span>Backlog / Later</span>
                            <div className="h-[1px] flex-1 bg-white/[0.04]" />
                        </motion.div>
                    )}

                    <motion.div
                      layout
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{
                        opacity: 1,
                        scale: 1,
                        backgroundColor: isSelected ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0)",
                        borderColor: isSelected ? "rgba(255,255,255,0.1)" : "transparent"
                      }}
                      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                      onClick={() => setSelectedIndex(index)}
                      className={`
                        group flex flex-col px-3 py-3 rounded-lg cursor-default select-none relative transition-all duration-200 border border-transparent
                        ${!isSelected && 'hover:bg-white/[0.04]'}
                        ${task.status === 'done' ? 'opacity-50' : 'opacity-100'}
                      `}
                    >
                      {/* Main Task Row */}
                      <div className="flex items-center gap-3 w-full">
                          {/* Active Indicator (Blue bar on left) */}
                          {isSelected && (
                             <motion.div layoutId="active-bar" className="absolute left-0 top-3 bottom-3 w-[3px] bg-indigo-500 rounded-r" />
                          )}

                          {/* Drag Handle */}
                          {viewMode !== 'archive' && (
                              <div className={`transition-opacity -ml-1 ${isSelected ? 'opacity-50 text-gray-400' : 'opacity-0 group-hover:opacity-100 text-gray-600'}`}>
                                <GripVertical size={14} />
                              </div>
                          )}

                          <LinearCheckbox
                            checked={task.status === 'done'}
                            onChange={() => toggleTask(task.id)}
                          />

                          <div className="flex-1 flex flex-col justify-center min-w-0">
                            <span className={`text-[13px] tracking-tight ${task.status === 'done' ? 'line-through text-gray-500' : isSelected ? 'text-white font-medium' : 'text-gray-200 font-medium'}`}>
                              {task.title}
                            </span>
                          </div>

                          {/* AI Action & Keyboard Hints */}
                          {viewMode !== 'archive' && (
                              <div className={`transition-all duration-200 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                  {isSelected ? (
                                    <div className="flex items-center gap-2">
                                        <span className="text-[9px] text-gray-500 font-mono bg-white/10 px-1 rounded">Space to toggle</span>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleBreakDown(task); }}
                                            className="h-5 px-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded flex items-center gap-1 text-[9px] text-indigo-400 font-medium"
                                        >
                                            <Sparkles size={9} />
                                            <span>AI</span>
                                        </button>
                                    </div>
                                  ) : (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleBreakDown(task); }}
                                        className="h-6 px-2 bg-[#1A1D21] hover:bg-[#25282D] border border-white/10 rounded flex items-center gap-1.5 text-[10px] text-gray-400 hover:text-indigo-400 font-medium shadow-sm"
                                    >
                                        <Sparkles size={10} />
                                        <span>Break Down</span>
                                    </button>
                                  )}
                              </div>
                          )}

                          {/* Metadata */}
                          <div className={`flex items-center gap-3 text-xs text-gray-500 font-mono transition-opacity duration-200 w-24 justify-end ${isSelected ? 'opacity-100' : 'group-hover:opacity-0'}`}>
                            {task.due && (
                              <div className={`flex items-center gap-1.5 ${task.due.includes('Today') ? 'text-emerald-400/90' : 'text-gray-500'}`}>
                                <span className="text-[10px] uppercase tracking-wider truncate max-w-[80px] text-right">{task.due}</span>
                              </div>
                            )}
                            {task.priority === 'High' && <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />}
                          </div>
                      </div>

                      {/* SUBTASKS AREA */}
                      <AnimatePresence>
                        {task.subtasks && task.subtasks.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="pl-[1.85rem] pt-1"
                          >
                            {task.subtasks.map((subtask, i) => (
                              <motion.div
                                key={subtask.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0, transition: { delay: i * 0.05 } }}
                                className="relative flex items-center gap-3 py-1.5 group/sub"
                              >
                                <div className="absolute left-[-14px] top-[-10px] bottom-[16px] w-[12px] border-l border-b border-white/10 rounded-bl-md" />
                                <LinearCheckbox
                                  size="sm"
                                  checked={subtask.status === 'done'}
                                  onChange={() => toggleSubtask(task.id, subtask.id)}
                                  />
                                <span className={`text-[12px] ${subtask.status === 'done' ? 'line-through text-gray-600' : 'text-gray-400'}`}>
                                  {subtask.title}
                                </span>
                              </motion.div>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>

                    </motion.div>
                  </React.Fragment>
                 );
              })}
            </AnimatePresence>

            {displayedTasks.length === 0 && (
              <div className="py-20 flex flex-col items-center justify-center text-gray-600 gap-3">
                 <div className="p-3 rounded-full bg-white/[0.02] border border-white/[0.05]">
                    {viewMode === 'archive' ? <History size={24} /> : <Inbox size={24} strokeWidth={1.5} />}
                 </div>
                 <span className="text-sm font-medium">{viewMode === 'archive' ? "No history yet" : "All caught up"}</span>
              </div>
            )}
          </div>
        </div>

        {/* FOOTER */}
        <div className="h-10 border-t border-white/[0.06] bg-[#16181A]/90 backdrop-blur-md flex items-center justify-between px-4 text-[11px] text-gray-500 font-medium flex-shrink-0">
          <div className="flex items-center gap-3">
             <div className="flex items-center gap-1.5 hover:text-gray-300 cursor-pointer transition-colors group">
               <Plus size={10} />
               <span>Create</span>
             </div>
             <div className="w-[1px] h-3 bg-white/10" />

             <button
                onClick={handleSmartSort}
                disabled={isSorting || viewMode === 'archive'}
                className={`flex items-center gap-1.5 cursor-pointer transition-colors group ${isSorting ? 'text-indigo-400' : 'hover:text-indigo-400'} ${viewMode === 'archive' ? 'opacity-50 cursor-not-allowed' : ''}`}
             >
               {isSorting ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} className="group-hover:fill-indigo-400/20" />}
               <span>{isSorting ? 'Prioritizing...' : 'Smart Prioritize'}</span>
             </button>
          </div>

          <div className="flex items-center gap-4">
            <button
                onClick={() => setViewMode(prev => prev === 'archive' ? 'focus' : 'archive')}
                className={`flex items-center gap-1.5 px-2 py-1 rounded hover:bg-white/5 transition-colors ${viewMode === 'archive' ? 'text-indigo-400 bg-indigo-500/10' : 'text-gray-500'}`}
            >
                <History size={12} />
                <span>History</span>
            </button>

            <div className="flex items-center gap-2 pl-4 border-l border-white/5">
               {selectedIndex !== -1 && (
                 <span className="text-[9px] font-mono text-gray-600 mr-2">
                    {selectedIndex + 1}/{displayedTasks.length}
                 </span>
               )}
              <div className="relative flex items-center justify-center">
                  <div className={`w-1.5 h-1.5 rounded-full ${viewMode === 'archive' ? 'bg-indigo-500' : 'bg-emerald-500'} z-10`} />
                  <div className={`absolute w-3 h-3 rounded-full ${viewMode === 'archive' ? 'bg-indigo-500/20' : 'bg-emerald-500/20'} animate-pulse`} />
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="mt-6 text-gray-600 text-xs font-mono opacity-40 flex gap-4">
        <span>↑↓ to navigate</span>
        <span>Space to toggle</span>
        <span>Del to archive</span>
      </div>

    </div>
  );
}
