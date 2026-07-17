// src/scripts/main.ts
// Single entry point loaded by the page — wires up each module.

import { initChrome } from './chrome';
import { initUpload } from './upload';
import { initChat } from './chat';
import { initAuth } from './auth';
import { initAccount } from './account';
import { initHistory } from './history';
import { initRobot } from './robot';

initChrome();
initUpload();
initChat();
initRobot();
initAuth();
initAccount();
initHistory();
