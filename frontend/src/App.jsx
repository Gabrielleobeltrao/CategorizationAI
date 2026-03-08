import { BrowserRouter as BrowserRouter, Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage.jsx'
import Login from './pages/Login.jsx'
import CreateAccount from './pages/CreateAccount.jsx'
import Home from './pages/Home.jsx'
import Transactions from './pages/Transactions.jsx'

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

        <Route 
          path="/register" 
          element={<CreateAccount />}
        />

        <Route 
          path="/home" 
          element={<Home />} 
        />

        <Route 
          path="/transactions" 
          element={<Transactions />} 
        />

      </Routes>
    </BrowserRouter>
  )
}

export default App
