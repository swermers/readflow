'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { Search, ArrowUpRight, Layers } from 'lucide-react';

export default function ArchivePage() {
  const [issues, setIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const supabase = createClient();

  useEffect(() => {
    fetchArchived();
  }, []);

  const fetchArchived = async () => {
    const { data, error } = await supabase
      .from('issues')
      .select('*, senders!inner(name, status)')
      .eq('status', 'archived')
      .order('archived_at', { ascending: false });

    if (error) {
      console.error('Error fetching archived issues:', error);
    }
    if (data) setIssues(data);
    setLoading(false);
  };

  const filtered = searchQuery.trim()
    ? issues.filter(
        (issue) =>
          issue.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          issue.snippet?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          issue.senders?.name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : issues;

  if (loading) return <div className="p-12 text-gray-400">Loading the vault...</div>;

  return (
    <div className="p-8 md:p-12 min-h-screen">

      {/* Header */}
      <header className="mb-12 border-b border-black pb-4">
        <h1 className="text-4xl font-bold tracking-tight text-[#1A1A1A]">The Vault.</h1>
        <p className="text-sm text-gray-500 mt-1">
          {issues.length} archived {issues.length === 1 ? 'issue' : 'issues'}.
        </p>
      </header>

      {/* Search Bar */}
      <div className="relative mb-12 max-w-lg">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search for topics, authors, or keywords..."
          className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all text-sm font-medium"
        />
      </div>

      {/* The List */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-lg border border-gray-100 border-dashed">
          <Layers className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          {searchQuery ? (
            <>
              <p className="text-gray-500 font-medium">No matches found.</p>
              <p className="text-sm text-gray-400">Try a different search term.</p>
            </>
          ) : (
            <>
              <p className="text-gray-500 font-medium">The Vault is empty.</p>
              <p className="text-sm text-gray-400">Archived issues will appear here.</p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((issue) => (
            <Link key={issue.id} href={`/newsletters/${issue.id}`}>
              <div className="group flex items-center justify-between p-4 bg-white border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer">

                <div className="flex-1 min-w-0 pr-8">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-bold text-sm text-gray-900">{issue.senders?.name || 'Unknown'}</span>
                    <span className="text-xs text-gray-400">&middot;</span>
                    <span className="text-xs text-gray-500">
                      {issue.archived_at
                        ? new Date(issue.archived_at).toLocaleDateString()
                        : new Date(issue.received_at).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="text-base font-medium text-black truncate group-hover:text-[#FF4E4E] transition-colors">{issue.subject}</h3>
                  <p className="text-sm text-gray-400 truncate mt-0.5">{issue.snippet}</p>
                </div>

                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <ArrowUpRight className="w-4 h-4 text-gray-400" />
                </div>

              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
