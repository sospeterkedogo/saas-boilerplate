'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from './userContext'

export interface Notification {
  id: string
  title: string
  message?: string
  type: string
  read: boolean
  created_at: string
}

interface NotificationsContextValue {
  notifications: Notification[]
  addNotification: (n: Notification) => void
  markAllAsRead: () => void
}

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined)

export function useNotifications() {
  const context = useContext(NotificationsContext)
  if (!context) throw new Error('useNotifications must be used within NotificationsProvider')
  return context
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const supabase = createClient()
  const { user } = useUser()
  const [notifications, setNotifications] = useState<Notification[]>([])

  useEffect(() => {
    if (!user) return

    // Fetch initial notifications
    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setNotifications(data as Notification[])
      })

    // Real-time subscription
    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        payload => {
          setNotifications(prev => {
            if (prev.some(n => n.id === payload.new.id)) return prev
            return [payload.new as Notification, ...prev]
          })
        }
      )
      .subscribe()

    return () => void supabase.removeChannel(channel)
  }, [user, supabase])

  const addNotification = (n: Notification) => {
    setNotifications(prev => {
      if (prev.some(p => p.id === n.id)) return prev
      return [n, ...prev]
    })
  }

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  return (
    <NotificationsContext.Provider value={{ notifications, addNotification, markAllAsRead }}>
      {children}
    </NotificationsContext.Provider>
  )
}
