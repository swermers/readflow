// lib/mockData.ts

export type Email = {
  id: string;
  senderName: string;
  senderEmail: string;
  subject: string;
  snippet: string;
  date: string;
  category: 'newsletter' | 'personal' | 'promo';
  read: boolean;
};

export const MOCK_EMAILS: Email[] = [
  {
    id: '1',
    senderName: 'Benedict Evans',
    senderEmail: 'benedict@ben-evans.com',
    subject: 'AI and the future of search',
    snippet: 'The question is not whether AI replaces search, but how it changes the model of...',
    date: 'Feb 06',
    category: 'newsletter',
    read: false,
  },
  {
    id: '2',
    senderName: 'Dense Discovery',
    senderEmail: 'news@densediscovery.com',
    subject: 'DD 241: Minimalist Living',
    snippet: 'A weekly selection of useful tools, books, and inspiring projects for creative people.',
    date: 'Feb 05',
    category: 'newsletter',
    read: true,
  },
  {
    id: '3',
    senderName: 'The Verge',
    senderEmail: 'verge@theverge.com',
    subject: 'Command Line: The new era',
    snippet: 'Plus: A review of the new minimalist phone concept.',
    date: 'Feb 05',
    category: 'newsletter',
    read: false,
  },
];