import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth'
import { supabaseConfigured } from './lib/supabase'
import { ToastProvider } from './components/ui'
import Layout from './components/Layout'
import RequireWorkspace from './components/Workspace'
import Dashboard from './pages/Dashboard'
import Signatures from './pages/Signatures'
import Editor from './pages/Editor'
import Templates from './pages/Templates'
import Team from './pages/Team'
import Campaigns from './pages/Campaigns'
import Analytics from './pages/Analytics'
import Brand from './pages/Brand'
import { Forgot, Login, MicrosoftCallback, Onboarding, ResetPassword, Signup } from './pages/Auth'
import Setup from './pages/Setup'
import Settings from './pages/Settings'
import MailRouting, { ExchangeCallback } from './pages/MailRouting'
import { Privacy, Terms } from './pages/Legal'
import { MarketingLayout } from './marketing/kit'
import { Blog, BlogPost, Contact, Features, Microsoft365, Pricing, Security, Showcase } from './marketing/Pages'

export default function App() {
  if (!supabaseConfigured) return <Setup />
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="login" element={<Login />} />
            <Route path="signup" element={<Signup />} />
            <Route path="forgot" element={<Forgot />} />
            <Route path="reset-password" element={<ResetPassword />} />
            <Route path="onboarding" element={<Onboarding />} />
            <Route path="microsoft/callback" element={<MicrosoftCallback />} />
            <Route element={<MarketingLayout />}>
              <Route path="features" element={<Features />} />
              <Route path="microsoft-365" element={<Microsoft365 />} />
              <Route path="showcase" element={<Showcase />} />
              <Route path="pricing" element={<Pricing />} />
              <Route path="security" element={<Security />} />
              <Route path="blog" element={<Blog />} />
              <Route path="blog/:slug" element={<BlogPost />} />
              <Route path="contact" element={<Contact />} />
            </Route>
            <Route path="terms" element={<Terms />} />
            <Route path="privacy" element={<Privacy />} />
            <Route element={<RequireWorkspace />}>
              <Route element={<Layout />}>
                <Route index element={<Dashboard />} />
                <Route path="signatures" element={<Signatures />} />
                <Route path="editor/:id" element={<Editor />} />
                <Route path="templates" element={<Templates />} />
                <Route path="team" element={<Team />} />
                <Route path="campaigns" element={<Campaigns />} />
                <Route path="insights" element={<Analytics />} />
                <Route path="brand" element={<Brand />} />
                <Route path="settings" element={<Settings />} />
                <Route path="mail-routing" element={<MailRouting />} />
                <Route path="exchange/callback" element={<ExchangeCallback />} />
                <Route path="*" element={<Dashboard />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  )
}
