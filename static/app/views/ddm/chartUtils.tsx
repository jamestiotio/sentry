import type {RefObject} from 'react';
import moment from 'moment';

import type {ReactEchartsRef} from 'sentry/types/echarts';

export function isInRect(x: number, y: number, rect: DOMRect | undefined) {
  if (!rect) {
    return false;
  }

  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

export type ValueRect = {
  xMax: number;
  xMin: number;
  yMax: number;
  yMin: number;
};

const DEFAULT_VALUE_RECT = {
  xMin: -Infinity,
  xMax: Infinity,
  yMin: 0,
  yMax: Infinity,
};

export function fitToValueRect(x: number, y: number, rect: ValueRect | undefined) {
  if (!rect) {
    return [x, y];
  }

  const xValue = x <= rect.xMin ? rect.xMin : x >= rect.xMax ? rect.xMax : x;
  const yValue = y <= rect.yMin ? rect.yMin : y >= rect.yMax ? rect.yMax : y;

  return [xValue, yValue];
}

export function getValueRect(chartRef?: RefObject<ReactEchartsRef>): ValueRect {
  const chartInstance = chartRef?.current?.getEchartsInstance();

  if (!chartInstance) {
    return DEFAULT_VALUE_RECT;
  }

  const finder = {xAxisId: 'xAxis', yAxisId: 'yAxis'};

  const topLeft = chartInstance.convertFromPixel(finder, [0, 0]);
  const bottomRight = chartInstance.convertFromPixel(finder, [
    chartInstance.getWidth(),
    chartInstance.getHeight(),
  ]);

  if (!topLeft || !bottomRight) {
    return DEFAULT_VALUE_RECT;
  }

  const xMin = moment(topLeft[0]).valueOf();
  const xMax = moment(bottomRight[0]).valueOf();
  const yMin = Math.max(0, bottomRight[1]);
  const yMax = topLeft[1];

  return {
    xMin,
    xMax,
    yMin,
    yMax,
  };
}
