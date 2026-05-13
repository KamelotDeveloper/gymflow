import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/admin/*" element={<div className="p-8 text-gray-700">Admin — en construcción</div>} />
        <Route path="/user/*"  element={<div className="p-8 text-gray-700">User — en construcción</div>} />
        <Route path="*"        element={<Navigate to="/admin" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
