import React, { useState, useEffect } from 'react'
import { Sun, Moon } from 'lucide-react'

interface ThemeToggleProps {
  className?: string
  showText?: boolean
}

export default function ThemeToggle({ className = '', showText = true }: ThemeToggleProps) {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark'
    }
    return false
  })

  useEffect(() => {
    // Initial sync
    const isDarkMode = document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark'
    setIsDark(isDarkMode)
    if (isDarkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [])

  const toggleTheme = () => {
    const next = !isDark
    setIsDark(next)
    if (next) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg border border-[#E5E0D8] dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[#1C231F] dark:text-zinc-100 hover:border-[#0E5C4A] dark:hover:border-emerald-500 transition-all text-xs font-bold shadow-xs cursor-pointer select-none ${className}`}
      title={isDark ? 'تغییر به تم روشن (Light Mode)' : 'تغییر به تم تاریک (Dark Mode)'}
      aria-label="تغییر تم"
    >
      {isDark ? (
        <>
          <Sun className="w-4 h-4 text-amber-400 shrink-0 animate-spin-slow" />
          {showText && <span>تم روشن</span>}
        </>
      ) : (
        <>
          <Moon className="w-4 h-4 text-[#2B5C8A] shrink-0" />
          {showText && <span>تم تاریک</span>}
        </>
      )}
    </button>
  )
}
