import { HashRouter, Route, Routes } from 'react-router-dom'
import { StoreProvider } from './store'
import { ToastProvider } from './components/ui'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Signatures from './pages/Signatures'
import Editor from './pages/Editor'
import Templates from './pages/Templates'
import Team from './pages/Team'
import Campaigns from './pages/Campaigns'
import Analytics from './pages/Analytics'
import Brand from './pages/Brand'

export default function App() {
  return (
    <StoreProvider>
      <ToastProvider>
        <HashRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="signatures" element={<Signatures />} />
              <Route path="editor/:id" element={<Editor />} />
              <Route path="templates" element={<Templates />} />
              <Route path="team" element={<Team />} />
              <Route path="campaigns" element={<Campaigns />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="brand" element={<Brand />} />
            </Route>
          </Routes>
        </HashRouter>
      </ToastProvider>
    </StoreProvider>
  )
}
