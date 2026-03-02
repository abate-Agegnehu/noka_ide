import React, { useState, useRef, useEffect } from 'react';
import { useIDEStore, FileNode } from '../store/useIDEStore';
import { GoogleGenAI, Type } from '@google/genai';
import { Send, Sparkles, Bot, User, Loader2, Code2, FolderPlus, FilePlus } from 'lucide-react';
import Markdown from 'react-markdown';
import { cn } from '../utils/helpers';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export const Chat: React.FC = () => {
  const { files, setFiles, isChatOpen, toggleChat } = useIDEStore();
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hello! I am your Nova AI assistant. I can help you generate code, create project structures, or answer technical questions. What would you like to build today?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
        throw new Error('GEMINI_API_KEY is not set correctly. Please update the GEMINI_API_KEY in your .env file with a valid key from Google AI Studio.');
      }

      const ai = new GoogleGenAI({ apiKey });
      
      // Prepare context: current file structure
      const fileContext = Object.values(files).map(f => ({
        id: f.id,
        name: f.name,
        type: f.type,
        parentId: f.parentId,
        language: f.language,
        content: f.content?.substring(0, 1000) // Limit content for context
      }));

      const response = await ai.models.generateContent({
        model: 'gemini-flash-latest',
        contents: [
          {
            role: 'user',
            parts: [{ text: `
              You are Nova AI, a professional coding assistant for the Nova IDE.
              
              Current project structure: ${JSON.stringify(fileContext)}
              
              User request: ${userMessage}
              
              If the user wants to create or modify files, respond with a JSON object that includes:
              1. A "message" string explaining what you're doing (use Markdown).
              2. A "files" array representing the NEW full state of ALL project files.
              
              CRITICAL: For every file in the "files" array, you MUST provide the FULL "content" string. 
              Do NOT leave "content" empty or truncated if it's a file.
              
              Each file in the "files" array must have:
              - id: string
              - name: string
              - type: 'file' | 'folder'
              - parentId: string | null
              - content: string (MANDATORY for files, provide the full code)
              - language: string (e.g., 'javascript', 'html', 'css')
              
              If it's just a question, respond with a "message" string and keep the "files" array as the current state.
              
              IMPORTANT: Always return the FULL project state in the "files" array if you make any changes.
              Always return valid JSON.
            ` }]
          }
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              message: { type: Type.STRING },
              files: { 
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    name: { type: Type.STRING },
                    type: { type: Type.STRING },
                    parentId: { type: Type.STRING },
                    content: { type: Type.STRING },
                    language: { type: Type.STRING }
                  },
                  required: ['id', 'name', 'type']
                }
              }
            },
            required: ['message']
          }
        }
      });

      const text = response.text;
      if (!text) throw new Error('Empty response from AI');
      
      const data = JSON.parse(text);
      
      setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
      
      if (data.files && Array.isArray(data.files)) {
        // Convert array back to record
        const newFiles: Record<string, FileNode> = {};
        data.files.forEach((f: any) => {
          newFiles[f.id] = {
            id: f.id,
            name: f.name,
            type: f.type as 'file' | 'folder',
            parentId: f.parentId || null,
            content: f.content,
            language: f.language
          };
        });
        setFiles(newFiles);
      }
    } catch (error: any) {
      console.error('AI Error Details:', error);
      const errorMessage = error.message || 'An unexpected error occurred.';
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `Sorry, I encountered an error: ${errorMessage}\n\nCheck the console for more details.` 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isChatOpen) return null;

  return (
    <div className="w-80 flex flex-col bg-slate-900 border-l border-white/5 h-full">
      <div className="p-4 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-blue-400" />
          <h2 className="text-sm font-semibold text-slate-200">Nova AI</h2>
        </div>
        <button onClick={toggleChat} className="text-slate-500 hover:text-slate-300">
          <Loader2 size={16} className={cn(isLoading && "animate-spin")} />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={cn("flex gap-3", msg.role === 'user' ? "flex-row-reverse" : "")}>
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
              msg.role === 'assistant' ? "bg-blue-500/20 text-blue-400" : "bg-slate-700 text-slate-300"
            )}>
              {msg.role === 'assistant' ? <Bot size={18} /> : <User size={18} />}
            </div>
            <div className={cn(
              "max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed",
              msg.role === 'assistant' ? "bg-white/5 text-slate-300" : "bg-blue-600 text-white"
            )}>
              <div className="markdown-body">
                <Markdown>{msg.content}</Markdown>
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <Bot size={18} />
            </div>
            <div className="bg-white/5 p-3 rounded-2xl">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" />
                <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-white/5">
        <div className="relative">
          <textarea
            rows={2}
            className="w-full bg-slate-800 text-slate-200 text-sm rounded-xl p-3 pr-10 outline-none border border-white/5 focus:border-blue-500/50 transition-colors resize-none"
            placeholder="Ask Nova to build something..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <button 
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="absolute right-2 bottom-2 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
        <p className="text-[10px] text-slate-500 mt-2 text-center">
          Nova AI can make mistakes. Verify important code.
        </p>
      </div>
    </div>
  );
};
