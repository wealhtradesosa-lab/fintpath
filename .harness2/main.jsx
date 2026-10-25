import { createRoot } from "react-dom/client";
import { useState } from "react";
import DeudasModule from "../src/components/DeudasModule.jsx";
function App() { const [d, setD] = useState([]); return <DeudasModule deudas={d} owners={[]} inversiones={[{ id: "loc", n: "Local macarena", va: 900e6 }]} onUpdate={setD} fmt={(v) => "$" + v} user={{}} plan="pro" trm={4000} />; }
createRoot(document.getElementById("root")).render(<App />);
