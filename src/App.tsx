import { useEffect, useState } from "react";
import { auth } from "./lib/firebase";

function App() {
  const [firebaseReady, setFirebaseReady] = useState(false);

  useEffect(() => {
    // Test Firebase connection
    const unsubscribe = auth.onAuthStateChanged(() => {
      setFirebaseReady(true);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold mb-4">Kicker Elo Tracker</h1>
      <p className="text-gray-400 mb-8">Table soccer ranking system</p>

      <div className="flex gap-2 items-center">
        <span
          className={`w-3 h-3 rounded-full ${firebaseReady ? "bg-green-500" : "bg-yellow-500 animate-pulse"}`}
        />
        <span className="text-sm text-gray-400">
          Firebase: {firebaseReady ? "Connected" : "Connecting..."}
        </span>
      </div>
    </div>
  );
}

export default App;
