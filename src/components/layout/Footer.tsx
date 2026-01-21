// src/components/layout/Footer.tsx
import React from 'react';
import Link from 'next/link';

export function Footer() {
  return (
    <footer className="bg-[var(--bg-secondary)] text-white py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-xl font-semibold mb-4">Dr. Karthik Nagarajan</h3>
            <p className="text-white/80">
              Associate Professor, Civil Engineering Department
            </p>
            <p className="text-white/80 mt-2">
              Remote Sensing Expert | GIS Specialist | Innovation Ambassador
            </p>
          </div>
          
          <div>
            <h3 className="text-xl font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li><Link href="/" className="text-white/80 hover:text-white">Home</Link></li>
              <li><Link href="#about" className="text-white/80 hover:text-white">About</Link></li>
              <li><Link href="#research" className="text-white/80 hover:text-white">Research</Link></li>
              <li><Link href="#publications" className="text-white/80 hover:text-white">Publications</Link></li>
              <li><Link href="#contact" className="text-white/80 hover:text-white">Contact</Link></li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-xl font-semibold mb-4">Connect</h3>
            <p className="text-white/80 mb-4">
              Follow on social media for updates on research, publications, and events.
            </p>
            <div className="flex space-x-4">
              <a
                href="#"
                className="text-white/80 hover:text-white transition-colors"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 118.3 6.5a1.78 1.78 0 01-1.8 1.75zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0013 14.19V19h-3v-9h2.9v1.3a3.11 3.11 0 012.7-1.4c1.55 0 3.36.86 3.36 3.66z"></path>
                </svg>
              </a>
              <a
                href="#"
                className="text-white/80 hover:text-white transition-colors"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Email"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
        
        <div className="mt-8 pt-8 border-t border-white/20 text-center">
          <p className="text-white/70">
            &copy; {new Date().getFullYear()} Dr. Karthik Nagarajan. All Rights Reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}