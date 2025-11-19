import React from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles,
  Wand2,
  MessageSquare,
  Code2,
  Palette,
  Zap,
  MousePointer2,
  Eye,
  Send,
  Monitor,
  Tablet,
  Smartphone,
  Upload,
  Play,
  Terminal,
  Bug,
  ChevronRight,
  Plus,
  Search,
  Settings,
  Folder,
  File,
} from 'lucide-react';

/**
 * Component Showcase - Enhanced Lovable Workspace
 * 
 * This file demonstrates all the enhanced UI components and features
 * of the Lovable-inspired workspace design.
 */

export const ComponentShowcase = () => {
  return (
    <div className="min-h-screen bg-gray-950 p-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <h1 className="text-5xl font-bold text-white mb-4">
          <span className="bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 bg-clip-text text-transparent">
            Enhanced Lovable Workspace
          </span>
        </h1>
        <p className="text-gray-400 text-lg">
          Ultra-premium components with superior animations and design
        </p>
      </motion.div>

      {/* Visual Editor Card */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold text-white mb-6">Visual Editor Component</h2>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="max-w-2xl mx-auto"
        >
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 via-pink-600/20 to-blue-600/20 blur-3xl" />
            <div className="relative bg-gradient-to-br from-purple-600 via-pink-600 to-blue-600 p-[2px] rounded-2xl shadow-2xl">
              <div className="bg-gray-900/95 backdrop-blur-xl rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <Wand2 className="h-5 w-5 text-purple-400" />
                    Edit visually
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-xs font-medium">
                      AI-Powered
                    </span>
                    <Sparkles className="h-5 w-5 text-yellow-400 animate-pulse" />
                  </div>
                </div>
                
                <p className="text-gray-300 text-sm">
                  Click to edit directly or describe changes to Lovable.
                </p>
                
                <div className="grid grid-cols-2 gap-3">
                  <button className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-4 py-3 rounded-xl flex items-center justify-center gap-2 font-medium shadow-lg transition-all duration-300 hover:scale-105">
                    <MousePointer2 className="h-4 w-4" />
                    Click to Edit
                  </button>
                  
                  <button className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-3 rounded-xl flex items-center justify-center gap-2 font-medium border border-gray-700 transition-all duration-300 hover:scale-105">
                    <MessageSquare className="h-4 w-4" />
                    Describe Changes
                  </button>
                </div>
                
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    Visual Mode
                  </span>
                  <span className="flex items-center gap-1">
                    <Code2 className="h-3 w-3" />
                    Code Sync
                  </span>
                  <span className="flex items-center gap-1">
                    <Palette className="h-3 w-3" />
                    Style Editor
                  </span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Gradient Buttons */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold text-white mb-6">Button Variants</h2>
        <div className="flex flex-wrap gap-4 justify-center">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl font-medium shadow-lg transition-all"
          >
            <Upload className="h-4 w-4 inline mr-2" />
            Gradient Button
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-medium border border-gray-700 transition-all"
          >
            <Play className="h-4 w-4 inline mr-2" />
            Dark Button
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-6 py-3 backdrop-blur-xl bg-gray-900/30 hover:bg-gray-900/50 text-white rounded-xl font-medium border border-gray-800/50 transition-all"
          >
            <Sparkles className="h-4 w-4 inline mr-2" />
            Glass Button
          </motion.button>
        </div>
      </section>

      {/* Loading States */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold text-white mb-6">Loading States</h2>
        <div className="flex flex-col items-center gap-8">
          {/* Rotating Gradient Spinner */}
          <div className="relative w-24 h-24">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
              className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 blur-md"
            />
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
              className="absolute inset-2 rounded-full bg-gray-950"
            />
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
              className="absolute inset-4 rounded-full bg-gradient-to-r from-purple-600 to-pink-600"
            />
          </div>
          
          {/* Bouncing Dots */}
          <div className="flex gap-2">
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ repeat: Infinity, duration: 0.6, delay: 0 }}
              className="w-3 h-3 bg-purple-500 rounded-full"
            />
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }}
              className="w-3 h-3 bg-pink-500 rounded-full"
            />
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }}
              className="w-3 h-3 bg-blue-500 rounded-full"
            />
          </div>
        </div>
      </section>

      {/* Chat Interface Preview */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold text-white mb-6">Chat Interface</h2>
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="max-w-2xl mx-auto bg-gray-900/50 backdrop-blur-md rounded-2xl border border-gray-800 p-4"
        >
          <div className="flex items-start gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1">
              <div className="bg-gray-800 rounded-xl p-4 shadow-lg">
                <p className="text-gray-100">
                  I'd love to help you build something amazing! What would you like to create today?
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex gap-2 mb-3">
            <button className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center gap-2 text-sm transition-colors">
              <Code2 className="h-4 w-4 text-blue-400" />
              <span className="text-gray-300">Build SaaS Landing</span>
            </button>
            <button className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center gap-2 text-sm transition-colors">
              <Palette className="h-4 w-4 text-purple-400" />
              <span className="text-gray-300">Create Portfolio</span>
            </button>
          </div>
          
          <div className="flex gap-2">
            <input
              placeholder="Ask Lovable..."
              className="flex-1 bg-gray-800 border-gray-700 text-gray-100 placeholder-gray-500 px-4 py-2 rounded-lg"
            />
            <button className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg flex items-center gap-2 text-white font-medium transition-all">
              <Send className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      </section>

      {/* Device Mode Selector */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold text-white mb-6">Device Mode Selector</h2>
        <div className="flex justify-center">
          <div className="flex items-center bg-gray-800 rounded-lg p-1">
            <button className="px-4 py-2 rounded-md bg-purple-600 text-white transition-colors">
              <Monitor className="h-5 w-5" />
            </button>
            <button className="px-4 py-2 rounded-md text-gray-400 hover:text-white transition-colors">
              <Tablet className="h-5 w-5" />
            </button>
            <button className="px-4 py-2 rounded-md text-gray-400 hover:text-white transition-colors">
              <Smartphone className="h-5 w-5" />
            </button>
          </div>
        </div>
      </section>

      {/* File Tree Sample */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold text-white mb-6">File Tree</h2>
        <div className="max-w-sm mx-auto bg-gray-900 rounded-xl border border-gray-800 p-4">
          <div className="space-y-1">
            <button className="w-full px-3 py-2 rounded-lg flex items-center gap-2 bg-gradient-to-r from-purple-600/20 to-pink-600/20 text-white border-l-2 border-purple-500">
              <ChevronRight className="h-4 w-4 rotate-90" />
              <Folder className="h-4 w-4 text-blue-400" />
              <span className="text-sm">components</span>
            </button>
            <div className="pl-6 space-y-1">
              <button className="w-full px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-800/50 text-gray-400 hover:text-gray-200">
                <File className="h-4 w-4 text-gray-500" />
                <span className="text-sm">Header.tsx</span>
              </button>
              <button className="w-full px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-800/50 text-gray-400 hover:text-gray-200">
                <File className="h-4 w-4 text-gray-500" />
                <span className="text-sm">Footer.tsx</span>
              </button>
            </div>
            <button className="w-full px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-800/50 text-gray-400 hover:text-gray-200">
              <ChevronRight className="h-4 w-4" />
              <Folder className="h-4 w-4 text-blue-400" />
              <span className="text-sm">pages</span>
            </button>
          </div>
        </div>
      </section>

      {/* Tabs Example */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold text-white mb-6">Tab Navigation</h2>
        <div className="max-w-md mx-auto">
          <div className="flex bg-gray-900 rounded-lg p-1">
            <button className="flex-1 px-4 py-2 rounded-md bg-gray-800 text-white flex items-center justify-center gap-2">
              <Monitor className="h-4 w-4" />
              Preview
            </button>
            <button className="flex-1 px-4 py-2 rounded-md text-gray-400 hover:text-white flex items-center justify-center gap-2">
              <Terminal className="h-4 w-4" />
              Console
            </button>
            <button className="flex-1 px-4 py-2 rounded-md text-gray-400 hover:text-white flex items-center justify-center gap-2">
              <Bug className="h-4 w-4" />
              Build
            </button>
          </div>
        </div>
      </section>

      {/* Color Palette */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold text-white mb-6">Color Palette</h2>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-4 max-w-4xl mx-auto">
          <div className="text-center">
            <div className="w-full h-24 bg-gradient-to-br from-purple-600 to-purple-700 rounded-lg mb-2"></div>
            <p className="text-xs text-gray-400">Purple</p>
          </div>
          <div className="text-center">
            <div className="w-full h-24 bg-gradient-to-br from-pink-600 to-pink-700 rounded-lg mb-2"></div>
            <p className="text-xs text-gray-400">Pink</p>
          </div>
          <div className="text-center">
            <div className="w-full h-24 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg mb-2"></div>
            <p className="text-xs text-gray-400">Blue</p>
          </div>
          <div className="text-center">
            <div className="w-full h-24 bg-gray-950 rounded-lg mb-2 border border-gray-800"></div>
            <p className="text-xs text-gray-400">Background</p>
          </div>
          <div className="text-center">
            <div className="w-full h-24 bg-gray-900 rounded-lg mb-2 border border-gray-800"></div>
            <p className="text-xs text-gray-400">Surface</p>
          </div>
          <div className="text-center">
            <div className="w-full h-24 bg-gray-800 rounded-lg mb-2"></div>
            <p className="text-xs text-gray-400">Border</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center py-8 border-t border-gray-800">
        <p className="text-gray-500 mb-2">Enhanced Lovable Workspace</p>
        <p className="text-gray-600 text-sm">Built with React, TypeScript, and Tailwind CSS</p>
        <div className="flex justify-center gap-4 mt-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
            className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600"
          />
        </div>
      </footer>
    </div>
  );
};

export default ComponentShowcase;