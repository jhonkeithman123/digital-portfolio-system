import type { Metric } from "web-vitals";

const reportWebVitals = (onPerfEntry?: (metric: Metric) => void): void => {
  if (onPerfEntry && typeof onPerfEntry === "function") {
    import("web-vitals").then((wvModule) => {
      const { getCLS, getFID, getFCP, getLCP, getTTFB } =
        wvModule as unknown as {
          getCLS: (cb: (m: Metric) => void) => void;
          getFID: (cb: (m: Metric) => void) => void;
          getFCP: (cb: (m: Metric) => void) => void;
          getLCP: (cb: (m: Metric) => void) => void;
          getTTFB: (cb: (m: Metric) => void) => void;
        };

      getCLS(onPerfEntry);
      getFID(onPerfEntry);
      getFCP(onPerfEntry);
      getLCP(onPerfEntry);
      getTTFB(onPerfEntry);
    });
  }
};

export default reportWebVitals;
