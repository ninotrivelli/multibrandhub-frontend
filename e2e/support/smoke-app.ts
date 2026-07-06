import { expect, type Page } from '@playwright/test';

import {
  API_BASE_URL,
  SMOKE_NOW,
  SMOKE_STORAGE_KEY,
  makeSmokeSession,
  resolveSmokeApiResponse,
  type SmokeRole,
} from '../../src/testing/smoke-fixtures';

const apiUrlPattern = `${API_BASE_URL}/**`;

export interface SmokeWatchers {
  runtimeErrors: string[];
  unexpectedApiCalls: string[];
}

export function collectSmokeWatchers(page: Page): SmokeWatchers {
  const watchers: SmokeWatchers = {
    runtimeErrors: [],
    unexpectedApiCalls: [],
  };

  page.on('console', (message) => {
    if (message.type() === 'error') {
      watchers.runtimeErrors.push(`console.error: ${message.text()}`);
    }
  });

  page.on('pageerror', (error) => {
    watchers.runtimeErrors.push(`pageerror: ${error.message}`);
  });

  return watchers;
}

export async function installSmokeClock(page: Page): Promise<void> {
  await page.clock.setFixedTime(new Date(SMOKE_NOW));
}

export async function mockSmokeApi(page: Page, watchers: SmokeWatchers): Promise<void> {
  await page.route(apiUrlPattern, async (route) => {
    const request = route.request();
    const response = resolveSmokeApiResponse({
      method: request.method(),
      url: request.url(),
      postData: request.postData(),
    });

    if (!response) {
      const url = new URL(request.url());
      const call = `${request.method()} ${url.pathname}${url.search}`;
      watchers.unexpectedApiCalls.push(call);
      await route.fulfill({
        status: 500,
        headers: corsHeaders(),
        json: { message: `Unexpected smoke API call: ${call}` },
      });
      return;
    }

    if (response.status === 204) {
      await route.fulfill({ status: 204, headers: corsHeaders() });
      return;
    }

    await route.fulfill({
      status: response.status,
      headers: corsHeaders(),
      json: response.body,
    });
  });
}

export async function installSession(page: Page, role: SmokeRole | null): Promise<void> {
  await page.addInitScript(
    ({ key, session }) => {
      localStorage.clear();
      if (session) {
        localStorage.setItem(key, JSON.stringify(session));
      }
    },
    {
      key: SMOKE_STORAGE_KEY,
      session: role ? makeSmokeSession(role) : null,
    },
  );
}

export async function gotoAs(page: Page, role: SmokeRole, path: string): Promise<void> {
  await installSession(page, role);
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}

export async function expectRouteReady(
  page: Page,
  pathPattern: RegExp,
  heading: string | RegExp,
): Promise<void> {
  await expect(page).toHaveURL(pathPattern);
  await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible();
  await expect(page.locator('main')).not.toHaveText(/^\s*$/);
}

export function expectSmokeClean(watchers: SmokeWatchers): void {
  expect(watchers.unexpectedApiCalls, 'unexpected API calls').toEqual([]);
  expect(watchers.runtimeErrors, 'runtime console/page errors').toEqual([]);
}

function corsHeaders(): Record<string, string> {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': 'authorization,content-type,x-tenant-host',
    'content-type': 'application/json',
  };
}
