import { BrowserRouter as BrowserRouter, Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage.jsx'
import Login from './pages/Login.jsx'

function App() {
  return (
    <BrowserRouter>
      <Routes>

        <Route 
          path="/" 
          element={<LandingPage />} 
        />

        <Route 
          path="/login" 
          element={<Login />} 
        />

      </Routes>
    </BrowserRouter>
  )
}

export default App
