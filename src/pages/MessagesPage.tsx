import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Check, CheckCheck, Search, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface Conversation {
  id: string;
  name: string;
  initials: string;
  lastMessage: string;
  time: string;
  unread: number;
  online: boolean;
}

interface Message {
  id: string;
  content: string;
  isMine: boolean;
  time: string;
  isRead: boolean;
}

const mockConversations: Conversation[] = [
  { id: "1", name: "Priya Sharma", initials: "PS", lastMessage: "Thanks for the referral! 🙏", time: "2m", unread: 2, online: true },
  { id: "2", name: "Arjun Mehta", initials: "AM", lastMessage: "The interview went great", time: "1h", unread: 0, online: true },
  { id: "3", name: "Maya Patel", initials: "MP", lastMessage: "Let's schedule the mentoring session", time: "3h", unread: 1, online: false },
  { id: "4", name: "Vikram Singh", initials: "VS", lastMessage: "Check out this opportunity", time: "1d", unread: 0, online: false },
  { id: "5", name: "Sarah Chen", initials: "SC", lastMessage: "Great talk at the meetup!", time: "2d", unread: 0, online: true },
];

const mockMessages: Record<string, Message[]> = {
  "1": [
    { id: "m1", content: "Hi Priya! I submitted the referral for the Google position.", isMine: true, time: "10:30 AM", isRead: true },
    { id: "m2", content: "Oh wow, that's amazing! Thank you so much! 🎉", isMine: false, time: "10:32 AM", isRead: true },
    { id: "m3", content: "I'll prepare well for the interview. Any tips?", isMine: false, time: "10:33 AM", isRead: true },
    { id: "m4", content: "Focus on system design and behavioral questions. I'll send you some resources.", isMine: true, time: "10:45 AM", isRead: true },
    { id: "m5", content: "Thanks for the referral! 🙏", isMine: false, time: "11:00 AM", isRead: false },
  ],
  "2": [
    { id: "m6", content: "Hey Arjun, how did the PM interview go?", isMine: true, time: "9:00 AM", isRead: true },
    { id: "m7", content: "The interview went great! They asked about product sense and metrics.", isMine: false, time: "9:15 AM", isRead: true },
  ],
};

export default function MessagesPage() {
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [conversations, setConversations] = useState(mockConversations);
  const [messages, setMessages] = useState(mockMessages);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [activeChat, messages]);

  const sendMessage = () => {
    if (!messageInput.trim() || !activeChat) return;
    const newMsg: Message = {
      id: `m${Date.now()}`,
      content: messageInput.trim(),
      isMine: true,
      time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      isRead: false,
    };
    setMessages((prev) => ({
      ...prev,
      [activeChat]: [...(prev[activeChat] || []), newMsg],
    }));
    setConversations((prev) =>
      prev.map((c) => c.id === activeChat ? { ...c, lastMessage: messageInput.trim(), time: "now" } : c)
    );
    setMessageInput("");
    // Simulate read receipt
    setTimeout(() => {
      setMessages((prev) => ({
        ...prev,
        [activeChat]: (prev[activeChat] || []).map((m) => m.id === newMsg.id ? { ...m, isRead: true } : m),
      }));
    }, 2000);
  };

  const filteredConversations = conversations.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const activePerson = conversations.find((c) => c.id === activeChat);
  const activeMessages = activeChat ? messages[activeChat] || [] : [];

  return (
    <div className="flex h-[calc(100vh-7rem)] bg-card border border-border rounded-xl overflow-hidden shadow-card">
      {/* Conversation list */}
      <div className={`w-full sm:w-80 border-r border-border flex flex-col shrink-0 ${activeChat ? "hidden sm:flex" : "flex"}`}>
        <div className="p-3 border-b border-border">
          <h2 className="font-heading font-semibold text-card-foreground mb-2">Messages</h2>
          <div className="flex items-center gap-2 bg-secondary rounded-lg px-3 py-1.5">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations..."
              className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-full"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.map((c) => (
            <button
              key={c.id}
              onClick={() => { setActiveChat(c.id); setConversations((prev) => prev.map((x) => x.id === c.id ? { ...x, unread: 0 } : x)); }}
              className={`w-full flex items-center gap-3 px-3 py-3 hover:bg-secondary/50 transition-colors text-left ${activeChat === c.id ? "bg-secondary" : ""}`}
            >
              <div className="relative">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-accent/10 text-accent font-heading text-sm">{c.initials}</AvatarFallback>
                </Avatar>
                {c.online && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-success border-2 border-card" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-card-foreground truncate">{c.name}</span>
                  <span className="text-[10px] text-muted-foreground">{c.time}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{c.lastMessage}</p>
              </div>
              {c.unread > 0 && (
                <Badge className="bg-accent text-accent-foreground text-[10px] h-5 w-5 p-0 flex items-center justify-center rounded-full">{c.unread}</Badge>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className={`flex-1 flex flex-col ${!activeChat ? "hidden sm:flex" : "flex"}`}>
        {activeChat && activePerson ? (
          <>
            <div className="h-14 border-b border-border flex items-center gap-3 px-4 shrink-0">
              <Button variant="ghost" size="icon" className="sm:hidden h-8 w-8" onClick={() => setActiveChat(null)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-accent/10 text-accent font-heading text-xs">{activePerson.initials}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium text-card-foreground">{activePerson.name}</p>
                <p className="text-[10px] text-muted-foreground">{activePerson.online ? "Online" : "Offline"}</p>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {activeMessages.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${m.isMine ? "justify-end" : "justify-start"}`}
                >
                  <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm ${
                    m.isMine
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-secondary text-foreground rounded-bl-md"
                  }`}>
                    <p>{m.content}</p>
                    <div className={`flex items-center gap-1 mt-1 ${m.isMine ? "justify-end" : ""}`}>
                      <span className="text-[10px] opacity-60">{m.time}</span>
                      {m.isMine && (
                        m.isRead
                          ? <CheckCheck className="h-3 w-3 opacity-60" />
                          : <Check className="h-3 w-3 opacity-40" />
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="border-t border-border p-3 flex gap-2">
              <Input
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder="Type a message..."
                className="flex-1"
              />
              <Button variant="hero" size="icon" type="submit" disabled={!messageInput.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center">
            <div>
              <Send className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Select a conversation to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
