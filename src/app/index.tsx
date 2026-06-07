import { createRoot } from "react-dom/client";

import { createBoundEvent } from "@shared/lib/createBoundEvent";
import { appModel } from "./model";
import { AppWithProviders } from "./ui";

export function initializeApp() {
  const boundAppStarted = createBoundEvent(appModel.appStarted);

  boundAppStarted();

  createRoot(document.getElementById("root")!).render(<AppWithProviders />);
}
