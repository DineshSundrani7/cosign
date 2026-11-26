import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { Chat, FaqSection } from "./components/cosign/Chat";
import { BuildLog, UnderTheHood } from "./components/cosign/Deep";
import { Demo } from "./components/cosign/Demo";
import { TwoDoors } from "./components/cosign/Doors";
import { LiveEngine } from "./components/cosign/LiveEngine";
import { Journey } from "./components/cosign/Journey";
import { About, Footer, GoToMarket, Hero, How, Landscape, Metrics, Nav, Problem, Sources, Who } from "./components/cosign/Sections";

function Index() {
  return (
    <>
      <a href="#demo" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-card focus:p-2">Skip to demo</a>
      <Nav />
      <main>
        <Hero />
        <Journey />
        <Problem />
        <TwoDoors />
        <How />
        <UnderTheHood />
        <LiveEngine />
        <Demo />
        <Landscape />
        <Who />
        <Metrics />
        <GoToMarket />
        <BuildLog />
        <About />
        <FaqSection />
        <Sources />
      </main>
      <Footer />
      <Chat />
    </>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><Index /></StrictMode>);
