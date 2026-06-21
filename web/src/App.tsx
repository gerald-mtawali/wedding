import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./App.css";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Rsvp from "./pages/Rsvp";
import Registry from "./pages/Registry";
import Directions from "./pages/Directions";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/rsvp" element={<Rsvp />} />
          <Route path="/registry" element={<Registry />} />
          <Route path="/directions" element={<Directions />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
