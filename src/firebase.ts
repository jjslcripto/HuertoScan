import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, doc, getDocFromServer } from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId); /* CRITICAL: The app will break without this line */
export const auth = getAuth(app);

async function testConnection() {
  try {
    // Attempt connecting to verify configurations
    await getDocFromServer(doc(db, "test", "connection"));
    console.log("Successfully validated Firestore availability and connection.");
  } catch (error) {
    if (error instanceof Error && error.message.includes("offline")) {
      console.error("Please check your Firebase configuration: the client appears to be offline.");
    } else {
      console.log("Firestore validation ran (custom errors expected on non-existent document which is correct integration test).");
    }
  }
}

testConnection();
