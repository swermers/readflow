'use client';

import { User, Bell, Shield, LogOut, Smartphone, Mail } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="p-8 md:p-12 min-h-screen max-w-4xl">
      
      {/* Header */}
      <header className="mb-16 border-b border-black pb-4">
        <h1 className="text-4xl font-bold tracking-tight text-[#1A1A1A]">Control Room.</h1>
        <p className="text-sm text-gray-500 mt-1">
          Preferences & Connection Status.
        </p>
      </header>

      <div className="space-y-12">
        
        {/* Section 1: Profile */}
        <section className="grid grid-cols-1 md:grid-cols-12 gap-8">
          <div className="md:col-span-4">
             <h3 className="font-bold text-lg text-black flex items-center gap-2">
               <User className="w-5 h-5 text-gray-400" />
               Profile
             </h3>
             <p className="text-sm text-gray-400 mt-1">How you appear in the app.</p>
          </div>
          <div className="md:col-span-8 space-y-6 bg-white p-6 border border-gray-200">
             
             <div className="grid grid-cols-2 gap-6">
               <div className="space-y-2">
                 <label className="text-xs font-bold uppercase tracking-widest text-gray-500">First Name</label>
                 <input type="text" defaultValue="Swiss" className="w-full border-b border-gray-300 py-2 text-black focus:outline-none focus:border-[#FF4E4E] transition-colors" />
               </div>
               <div className="space-y-2">
                 <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Last Name</label>
                 <input type="text" defaultValue="Designer" className="w-full border-b border-gray-300 py-2 text-black focus:outline-none focus:border-[#FF4E4E] transition-colors" />
               </div>
             </div>

             <div className="space-y-2">
                 <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Email Address</label>
                 <input type="email" defaultValue="demo@readflow.app" disabled className="w-full border-b border-gray-200 py-2 text-gray-400 bg-gray-50 cursor-not-allowed" />
             </div>

          </div>
        </section>

        {/* Section 2: Sync Settings */}
        <section className="grid grid-cols-1 md:grid-cols-12 gap-8 pt-12 border-t border-gray-100">
          <div className="md:col-span-4">
             <h3 className="font-bold text-lg text-black flex items-center gap-2">
               <Mail className="w-5 h-5 text-gray-400" />
               Sync & Connections
             </h3>
             <p className="text-sm text-gray-400 mt-1">Manage your email link.</p>
          </div>
          <div className="md:col-span-8 bg-white border border-gray-200">
             
             {/* Connection Status Card */}
             <div className="p-6 flex items-center justify-between border-b border-gray-100">
                <div className="flex items-center gap-4">
                   <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                     <Shield className="w-5 h-5" />
                   </div>
                   <div>
                     <h4 className="font-bold text-black">Gmail Connected</h4>
                     <p className="text-xs text-gray-500">Last synced: 2 minutes ago</p>
                   </div>
                </div>
                <button className="text-xs font-bold uppercase text-gray-400 hover:text-[#FF4E4E]">Reconnect</button>
             </div>

             {/* Toggles */}
             <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                   <div>
                      <div className="font-bold text-sm text-black">Smart Filtering</div>
                      <div className="text-xs text-gray-400">Automatically move newsletters to the Rack.</div>
                   </div>
                   <div className="w-10 h-5 bg-[#1A1A1A] rounded-full relative cursor-pointer">
                      <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full"></div>
                   </div>
                </div>

                <div className="flex items-center justify-between">
                   <div>
                      <div className="font-bold text-sm text-black">Daily Digest</div>
                      <div className="text-xs text-gray-400">Receive a summary email at 8:00 AM.</div>
                   </div>
                   <div className="w-10 h-5 bg-gray-200 rounded-full relative cursor-pointer">
                      <div className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full shadow-sm"></div>
                   </div>
                </div>
             </div>

          </div>
        </section>

        {/* Section 3: Danger Zone */}
        <section className="grid grid-cols-1 md:grid-cols-12 gap-8 pt-12 border-t border-gray-100">
          <div className="md:col-span-4">
             <h3 className="font-bold text-lg text-[#FF4E4E] flex items-center gap-2">
               <LogOut className="w-5 h-5" />
               Danger Zone
             </h3>
          </div>
          <div className="md:col-span-8">
             <button className="px-6 py-3 border border-red-200 bg-red-50 text-[#FF4E4E] text-xs font-bold uppercase tracking-widest hover:bg-[#FF4E4E] hover:text-white transition-colors">
               Disconnect & Delete Data
             </button>
          </div>
        </section>

      </div>
    </div>
  );
}