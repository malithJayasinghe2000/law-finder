import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { 
  BookOpen, Briefcase, Clock, 
  RefreshCw, PenSquare, Search, Users, ShieldCheck, 
  MessageCircle, Eye, ChevronUp, ChevronDown, Check, X 
} from 'lucide-react';
import MockHeader from '../MockHeader';

interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  author: string;
  role: string;
  isVerified: boolean;
  date: string;
  readTime: string;
  category: string;
  score: number;
  commentCount: number;
  viewCount: number;
  isPinned?: boolean;
}

export default function BlogShowcase() {
  const initialPosts: BlogPost[] = [
    {
      id: 'post-1',
      title: 'Tenant Rights 101: Preventing Unlawful Landlord Lockouts',
      excerpt: 'Understand what procedures a landlord must legally complete under the Rent Act of Sri Lanka before attempting eviction.',
      author: 'Nadeesha Bandara',
      role: 'Analyst',
      isVerified: false,
      date: 'June 28, 2026',
      readTime: '5 min read',
      category: 'Property Law',
      score: 24,
      commentCount: 5,
      viewCount: 120,
      isPinned: true
    },
    {
      id: 'post-2',
      title: 'How to Validate Supreme Court Advocate Registrations',
      excerpt: 'A step-by-step checklist to verify a lawyer\'s credentials, license status, and active court status before hire.',
      author: 'Dr. Lakmal Perera',
      role: 'Lawyer',
      isVerified: true,
      date: 'May 14, 2026',
      readTime: '4 min read',
      category: 'Legal Advice',
      score: 8,
      commentCount: 2,
      viewCount: 45
    },
    {
      id: 'post-3',
      title: 'Guide to Navigating Sri Lankan Debt Recovery Courts',
      excerpt: 'A simplified breakdown of how small claims and summary procedures work for commercial disputes under Rs. 1,000,000.',
      author: 'Anjali Senanayake',
      role: 'Lawyer',
      isVerified: true,
      date: 'April 02, 2026',
      readTime: '7 min read',
      category: 'Finance & Debts',
      score: 15,
      commentCount: 4,
      viewCount: 88
    }
  ];

  const [posts, setPosts] = useState<BlogPost[]>(initialPosts);
  const [postsCount, setPostsCount] = useState(142);
  const [votes, setVotes] = useState<Record<string, 'UPVOTE' | 'DOWNVOTE' | null>>({});
  const [typedSearchQuery, setTypedSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [highlightNewPost, setHighlightNewPost] = useState(false);
  const [key, setKey] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, amount: 0.1 });

  // Filter posts based on search query
  const filteredPosts = posts.filter(post => 
    post.title.toLowerCase().includes(typedSearchQuery.toLowerCase()) ||
    post.excerpt.toLowerCase().includes(typedSearchQuery.toLowerCase()) ||
    post.category.toLowerCase().includes(typedSearchQuery.toLowerCase())
  );

  useEffect(() => {
    if (!isInView) return;

    let active = true;
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

    // Reset states on restart
    setPosts(initialPosts);
    setPostsCount(142);
    setVotes({});
    setTypedSearchQuery('');
    setIsModalOpen(false);
    setNewPostTitle('');
    setNewPostContent('');
    setHighlightNewPost(false);

    const runSimulation = async () => {
      // 1. Initial delay
      await sleep(1500);
      if (!active) return;

      // 2. Vote Up Animation
      setVotes(prev => ({ ...prev, 'post-1': 'UPVOTE' }));
      setPosts(prev => prev.map(p => p.id === 'post-1' ? { ...p, score: p.score + 1 } : p));
      
      await sleep(2000);
      if (!active) return;

      // 3. Search typing animation
      const searchQuery = 'Tenant';
      let currentQuery = '';
      for (let i = 0; i < searchQuery.length; i++) {
        if (!active) return;
        currentQuery += searchQuery[i];
        setTypedSearchQuery(currentQuery);
        await sleep(150);
      }

      await sleep(2500);
      if (!active) return;

      // 4. Clear search query to show all posts again
      for (let i = searchQuery.length; i >= 0; i--) {
        if (!active) return;
        setTypedSearchQuery(searchQuery.substring(0, i));
        await sleep(80);
      }

      await sleep(1000);
      if (!active) return;

      // 5. Click "Create Post" -> Open modal
      setIsModalOpen(true);
      
      await sleep(1550);
      if (!active) return;

      // 6. Type new post title inside modal
      const titleText = 'Notice Periods for Sri Lankan Landlords';
      let currentTitle = '';
      for (let i = 0; i < titleText.length; i++) {
        if (!active) return;
        currentTitle += titleText[i];
        setNewPostTitle(currentTitle);
        await sleep(40);
      }

      await sleep(800);
      if (!active) return;

      // 7. Type new post content inside modal
      const contentText = 'Under the Rent Act, landlords must provide a valid written notice period. Evictions without a court order are completely illegal.';
      let currentContent = '';
      for (let i = 0; i < contentText.length; i++) {
        if (!active) return;
        currentContent += contentText[i];
        setNewPostContent(currentContent);
        await sleep(20);
      }

      await sleep(1500);
      if (!active) return;

      // 8. Submit post: Add to feed, increment total count, close modal
      const newPost: BlogPost = {
        id: 'post-new',
        title: titleText,
        excerpt: contentText,
        author: 'Dr. Lakmal Perera',
        role: 'Lawyer',
        isVerified: true,
        date: 'Just now',
        readTime: '3 min read',
        category: 'Property Law',
        score: 1,
        commentCount: 0,
        viewCount: 15
      };

      setPosts(prev => [newPost, ...prev]);
      setPostsCount(prev => prev + 1);
      setIsModalOpen(false);
      setHighlightNewPost(true);

      // Reset typing variables
      setNewPostTitle('');
      setNewPostContent('');

      await sleep(3000);
      if (!active) return;
      setHighlightNewPost(false);
    };

    runSimulation();

    return () => {
      active = false;
    };
  }, [isInView, key]);

  const handleVote = (id: string, type: 'UPVOTE' | 'DOWNVOTE') => {
    setVotes(prev => {
      const currentVote = prev[id];
      if (currentVote === type) {
        // Undo vote
        setPosts(posts => posts.map(p => p.id === id ? { ...p, score: type === 'UPVOTE' ? p.score - 1 : p.score + 1 } : p));
        return { ...prev, [id]: null };
      } else {
        // Vote
        let scoreDiff = 0;
        if (!currentVote) scoreDiff = type === 'UPVOTE' ? 1 : -1;
        else scoreDiff = type === 'UPVOTE' ? 2 : -2; // flip vote

        setPosts(posts => posts.map(p => p.id === id ? { ...p, score: p.score + scoreDiff } : p));
        return { ...prev, [id]: type };
      }
    });
  };

  return (
    <div 
      ref={containerRef}
      className="w-full bg-[#faf8f5] rounded-xl overflow-hidden border border-neutral-200 text-left font-sans text-neutral-800 flex flex-col shadow-lg select-none relative"
    >
      {/* Header */}
      <MockHeader activeTab="LEGAL LIBRARY" />

      {/* Main Container */}
      <div className="p-6 sm:p-8 space-y-6 max-h-[550px] overflow-y-auto relative">
        
        {/* Editorial Hero Header */}
        <div className="relative border border-[#efeae0] bg-[#faf8f6] p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          <div className="space-y-2.5 max-w-md">
            <span className="inline-flex text-[8px] font-bold uppercase tracking-[0.2em] text-[#bfa37a] bg-[#bfa37a]/10 px-3 py-1 border border-[#bfa37a]/20">
              Community Hub
            </span>
            <h1 className="text-xl sm:text-2xl font-serif tracking-tight text-neutral-900 leading-tight">
              Sri Lanka&apos;s Legal <br />Knowledge Community
            </h1>
            <p className="text-neutral-500 text-[10px] font-light leading-relaxed">
              Connect with verified lawyers, share legal experiences, and discover expert insights across all areas of Sri Lankan law.
            </p>
            <div className="flex gap-2 pt-1.5">
              <button 
                onClick={() => setIsModalOpen(true)}
                className="bg-[#bfa37a] text-white hover:bg-[#a68d67] px-4 py-2 text-[9px] font-bold uppercase tracking-widest transition-all flex items-center gap-1"
              >
                <PenSquare className="h-3 w-3" />
                <span>Create Post</span>
              </button>
              <button 
                onClick={() => setKey(prev => prev + 1)}
                className="border border-[#bfa37a] text-[#bfa37a] hover:bg-[#bfa37a]/5 px-3 py-2 text-[9px] font-bold uppercase tracking-widest transition-all flex items-center gap-1"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Replay</span>
              </button>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="flex gap-6 border-t sm:border-t-0 sm:border-l border-[#efeae0] pt-4 sm:pt-0 sm:pl-6 shrink-0 w-full sm:w-auto">
            <div className="text-center space-y-0.5 min-w-[60px]">
              <Users className="h-4 w-4 text-[#bfa37a] mx-auto mb-1 stroke-[1.5]" />
              <div className="text-base font-serif font-bold text-neutral-900">1,240</div>
              <div className="text-[8px] text-neutral-400 font-bold uppercase tracking-widest">Members</div>
            </div>
            <div className="text-center space-y-0.5 min-w-[60px]">
              <BookOpen className="h-4 w-4 text-[#bfa37a] mx-auto mb-1 stroke-[1.5]" />
              <div className="text-base font-serif font-bold text-neutral-900">{postsCount}</div>
              <div className="text-[8px] text-neutral-400 font-bold uppercase tracking-widest">Posts</div>
            </div>
            <div className="text-center space-y-0.5 min-w-[60px]">
              <Briefcase className="h-4 w-4 text-[#bfa37a] mx-auto mb-1 stroke-[1.5]" />
              <div className="text-base font-serif font-bold text-neutral-900">8</div>
              <div className="text-[8px] text-neutral-400 font-bold uppercase tracking-widest">topics</div>
            </div>
          </div>
        </div>

        {/* 2-Column Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Main Feed Column (Left) */}
          <div className="lg:col-span-8 space-y-4">
            <AnimatePresence mode="popLayout">
              {filteredPosts.map((post) => {
                const hasVotedUp = votes[post.id] === 'UPVOTE';
                const hasVotedDown = votes[post.id] === 'DOWNVOTE';
                const isNewPost = post.id === 'post-new';

                return (
                  <motion.article
                    key={post.id}
                    layout
                    initial={isNewPost ? { opacity: 0, y: -40, scale: 0.95 } : { opacity: 1, y: 0 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 200, damping: 20 }}
                    className={`flex bg-white border rounded-none transition-all duration-300 ${
                      isNewPost && highlightNewPost
                        ? 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.15)] bg-emerald-50/10'
                        : 'border-[#efeae0] hover:shadow-md hover:border-[#bfa37a]/35'
                    }`}
                  >
                    {/* Vote Column */}
                    <div className="flex flex-col items-center justify-start py-4 px-3 bg-[#faf8f6] border-r border-[#efeae0]/80 shrink-0">
                      <button 
                        onClick={() => handleVote(post.id, 'UPVOTE')}
                        className={`p-1 rounded hover:bg-neutral-200 transition-colors ${hasVotedUp ? 'text-[#bfa37a]' : 'text-neutral-400'}`}
                      >
                        <ChevronUp className="w-4 h-4 stroke-[2.5]" />
                      </button>
                      <span className={`text-[10px] font-bold font-mono my-0.5 ${hasVotedUp ? 'text-[#bfa37a]' : 'text-neutral-700'}`}>
                        {post.score}
                      </span>
                      <button 
                        onClick={() => handleVote(post.id, 'DOWNVOTE')}
                        className={`p-1 rounded hover:bg-neutral-200 transition-colors ${hasVotedDown ? 'text-red-600' : 'text-neutral-400'}`}
                      >
                        <ChevronDown className="w-4 h-4 stroke-[2.5]" />
                      </button>
                    </div>

                    {/* Content Column */}
                    <div className="flex-1 p-4 sm:p-5 text-left min-w-0">
                      {/* Meta information row */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[9px] text-neutral-450 mb-2 font-light">
                        <span className="font-bold text-[#bfa37a] uppercase tracking-widest">
                          {post.category}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          Posted by{' '}
                          <span className="font-semibold text-neutral-700">{post.author}</span>
                          {post.isVerified && (
                            <ShieldCheck className="h-3 w-3 text-[#bfa37a] fill-[#bfa37a]/10" />
                          )}
                          <span className={`text-[7px] font-bold uppercase tracking-widest px-1.5 py-0.5 border ${
                            post.role === 'Lawyer' 
                              ? 'text-[#bfa37a] bg-[#bfa37a]/5 border-[#bfa37a]/15' 
                              : 'text-neutral-500 bg-neutral-100 border-neutral-200'
                          }`}>
                            {post.role}
                          </span>
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1 font-semibold uppercase tracking-widest text-[8px]">
                          <Clock className="h-2.5 w-2.5" /> {post.date}
                        </span>
                      </div>

                      {/* Title */}
                      <h3 className="text-sm sm:text-base font-serif font-bold text-neutral-900 leading-snug hover:text-[#bfa37a] transition-colors cursor-pointer mb-2">
                        {post.title}
                      </h3>

                      {/* Excerpt */}
                      <p className="text-neutral-450 text-[10.5px] font-light leading-relaxed line-clamp-2 mb-4">
                        {post.excerpt}
                      </p>

                      {/* Actions Bar */}
                      <div className="flex items-center gap-3.5 text-[9px] font-bold uppercase tracking-widest text-neutral-450">
                        <div className="flex items-center gap-1 py-1 px-2 bg-neutral-50 border border-transparent">
                          <MessageCircle className="h-3 w-3" />
                          <span>{post.commentCount} Comments</span>
                        </div>
                        <div className="flex items-center gap-1 py-1 px-2 bg-neutral-50 border border-transparent">
                          <Eye className="h-3 w-3" />
                          <span>{post.viewCount} Views</span>
                        </div>
                        <span className="text-[8px] border border-neutral-200 px-2 py-0.5 text-neutral-400 bg-neutral-50 ml-auto font-bold uppercase">
                          English
                        </span>
                      </div>
                    </div>
                  </motion.article>
                );
              })}

              {filteredPosts.length === 0 && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-8 text-center bg-white border border-[#efeae0] text-neutral-400 text-xs font-light"
                >
                  No community discussions match your query. Try searching for other terms.
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Sidebar Column (Right) */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Search Box */}
            <div className="border border-[#efeae0] bg-[#faf8f6] p-4 text-left space-y-3">
              <h4 className="font-serif font-bold text-xs uppercase tracking-wider text-neutral-900 border-b border-[#efeae0] pb-2">
                Search Hub
              </h4>
              <div className="flex relative">
                <input 
                  type="text" 
                  value={typedSearchQuery}
                  onChange={(e) => setTypedSearchQuery(e.target.value)}
                  placeholder="Search articles, keywords..." 
                  className="w-full bg-white border border-[#efeae0] px-3 py-2 pl-7 outline-none focus:border-[#bfa37a] text-[10.5px] font-light text-neutral-800"
                />
                <Search className="h-3 w-3 text-neutral-400 absolute left-2.5 top-2.5" />
                {typedSearchQuery && (
                  <button 
                    onClick={() => setTypedSearchQuery('')}
                    className="absolute right-2 top-2 p-0.5 text-neutral-400 hover:text-neutral-700"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Categories */}
            <div className="border border-neutral-950 bg-[#19191c] text-white p-4 text-left">
              <h4 className="font-serif font-bold text-xs uppercase tracking-wider text-white mb-3 flex items-center gap-1.5 border-b border-white/10 pb-2.5">
                <Users className="h-3.5 w-3.5 text-[#bfa37a]" /> 
                <span>Topics</span>
              </h4>
              <div className="space-y-1">
                {[
                  { name: 'Property Law', count: 42 },
                  { name: 'Corporate Law', count: 28 },
                  { name: 'Criminal Defense', count: 19 },
                  { name: 'Family Law', count: 35 }
                ].map((cat) => (
                  <div 
                    key={cat.name}
                    className="flex items-center justify-between py-2 border-b border-white/5 hover:border-[#bfa37a]/30 transition-all cursor-pointer group"
                    onClick={() => setTypedSearchQuery(cat.name)}
                  >
                    <span className="text-[10px] font-semibold text-neutral-300 group-hover:text-[#bfa37a] group-hover:translate-x-1 transition-all uppercase tracking-wider">
                      {cat.name}
                    </span>
                    <span className="text-[8px] text-white/40 bg-white/5 px-2 py-0.5 group-hover:text-[#bfa37a] transition-all">
                      {cat.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Community Guidelines */}
            <div className="border border-[#efeae0] bg-white p-4 text-left">
              <h3 className="font-serif font-bold text-xs uppercase tracking-wider text-neutral-900 mb-3 border-b border-[#efeae0] pb-2 flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5 text-[#bfa37a]" /> 
                <span>Guidelines</span>
              </h3>
              <ul className="space-y-2.5 text-[10px] text-neutral-500 font-light">
                <li className="flex gap-1.5"><span className="text-[#bfa37a] font-bold">1.</span> Be respectful and professional</li>
                <li className="flex gap-1.5"><span className="text-[#bfa37a] font-bold">2.</span> Discuss law, do not offer concrete advice</li>
                <li className="flex gap-1.5"><span className="text-[#bfa37a] font-bold">3.</span> Protect privacy — do not share case files</li>
              </ul>
            </div>

          </div>

        </div>

      </div>

      {/* CREATE POST MODAL BACKDROP & DIALOG */}
      <AnimatePresence>
        {isModalOpen && (
          <>
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black z-40"
            />

            {/* Modal Dialog */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="absolute inset-x-6 top-24 bottom-24 sm:inset-x-12 sm:top-24 sm:bottom-24 bg-white border border-[#efeae0] shadow-2xl z-50 p-5 sm:p-6 flex flex-col justify-between"
            >
              <div className="space-y-4 flex-1 overflow-y-auto">
                <div className="flex justify-between items-center border-b border-neutral-100 pb-3">
                  <div className="flex items-center gap-1.5">
                    <PenSquare className="w-4 h-4 text-[#bfa37a]" />
                    <span className="font-serif font-bold text-neutral-900 text-sm">Create Community Post</span>
                  </div>
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="p-1 rounded hover:bg-neutral-100 text-neutral-450 hover:text-neutral-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-3.5 text-xs text-left">
                  {/* Topic Select */}
                  <div className="space-y-1">
                    <label className="font-bold text-neutral-500 uppercase tracking-widest text-[8px] block">Select Topic</label>
                    <div className="border border-neutral-200 rounded px-3 py-2 bg-neutral-50 text-[10.5px] text-neutral-700 flex justify-between items-center cursor-default">
                      <span>Property Law</span>
                      <Check className="w-3 h-3 text-emerald-600" />
                    </div>
                  </div>

                  {/* Title Input */}
                  <div className="space-y-1">
                    <label className="font-bold text-neutral-500 uppercase tracking-widest text-[8px] block">Post Title</label>
                    <input 
                      type="text" 
                      value={newPostTitle}
                      readOnly
                      placeholder="Title of your post..." 
                      className="w-full bg-white border border-neutral-200 rounded px-3.5 py-2 text-[10.5px] text-neutral-800 focus:outline-none"
                    />
                  </div>

                  {/* Content Textarea */}
                  <div className="space-y-1">
                    <label className="font-bold text-neutral-500 uppercase tracking-widest text-[8px] block">Post Content</label>
                    <textarea 
                      value={newPostContent}
                      readOnly
                      rows={4}
                      placeholder="Share your insights, questions, or legal analysis..." 
                      className="w-full bg-white border border-neutral-200 rounded px-3.5 py-2 text-[10.5px] text-neutral-800 focus:outline-none resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2.5 pt-4 border-t border-neutral-100 mt-4 shrink-0">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="border border-neutral-250 text-neutral-600 hover:bg-neutral-50 px-4 py-2 text-[9px] font-bold uppercase tracking-widest transition-all"
                >
                  Cancel
                </button>
                <button 
                  disabled
                  className="bg-[#bfa37a] text-white px-4 py-2 text-[9px] font-bold uppercase tracking-widest transition-all opacity-85 flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Publishing...</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}
