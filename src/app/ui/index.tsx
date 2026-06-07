import { MantineProvider } from "@mantine/core";
import { Provider } from "effector-react";

import { theme } from "@shared/config/theme";
import { appScope } from "@shared/config/effector";
import { App } from "./app";

import "@mantine/core/styles.css";
import "./app.css";

export const AppWithProviders = () => {
  return (
    <Provider value={appScope}>
      <MantineProvider theme={theme}>
        <App />
      </MantineProvider>
    </Provider>
  );
};
