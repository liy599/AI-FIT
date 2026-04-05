import './globals.css'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'
import TabBar from '@/components/TabBar'

export const metadata: Metadata = {
  title: 'Train'
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <SiteHeader />
        {children}
        <SiteFooter />
        <TabBar />
      </body>
    </html>
  )
}
