export function notificationServiceMock() {
  return {
    success: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

export function loadingServiceMock() {
  return {
    start: vi.fn(),
    stop: vi.fn(),
    isLoading: () => false,
  };
}
