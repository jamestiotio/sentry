import * as Sentry from '@sentry/react';

import {
  getDateTimeParams,
  MetricMetaCodeLocation,
  MetricRange,
} from 'sentry/utils/metrics';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

type ApiResponse = {
  metrics: MetricMetaCodeLocation[];
};

type MetricsDDMMetaOpts = MetricRange & {
  codeLocations?: boolean;
  metricSpans?: boolean;
};

function useMetricsDDMMeta(mri: string | undefined, options: MetricsDDMMetaOpts) {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const {start, end} = options;
  const dateTimeParams =
    start || end ? {start, end} : getDateTimeParams(selection.datetime);

  const minMaxParams =
    // remove non-numeric values
    options.min && options.max && !isNaN(options.min) && !isNaN(options.max)
      ? {min: options.min, max: options.max}
      : {};

  const queryInfo = useApiQuery<ApiResponse>(
    [
      `/organizations/${organization.slug}/ddm/meta/`,
      {
        query: {
          metric: mri,
          project: selection.projects,
          codeLocations: options.codeLocations,
          metricSpans: options.metricSpans,
          ...dateTimeParams,
          ...minMaxParams,
        },
      },
    ],
    {
      enabled: !!mri,
      staleTime: Infinity,
    }
  );

  if (!queryInfo.data) {
    return queryInfo;
  }

  const data = sortCodeLocations(
    deduplicateCodeLocations(mapToNewResponseShape(queryInfo.data))
  );

  return {...queryInfo, data};
}

export function useMetricsSpans(mri: string | undefined, options: MetricRange = {}) {
  return useMetricsDDMMeta(mri, {
    ...options,
    metricSpans: true,
    // TODO: remove this once metric spans starts returning data
    codeLocations: true,
  });
}

export function useMetricsCodeLocations(
  mri: string | undefined,
  options: MetricRange = {}
) {
  return useMetricsDDMMeta(mri, {...options, codeLocations: true});
}

const mapToNewResponseShape = (data: ApiResponse) => {
  // If the response is already in the new shape, do nothing
  if (data.metrics) {
    return data;
  }

  const newData = {...data};
  // @ts-expect-error codeLocations is defined in the old response shape
  newData.metrics = (data.codeLocations ?? [])?.map(codeLocation => {
    return {
      mri: codeLocation.mri,
      timestamp: codeLocation.timestamp,
      // @ts-expect-error metricSpans is defined in the old response shape
      metricSpans: data.metricSpans,
      codeLocations: (codeLocation.frames ?? []).map(frame => {
        return {
          function: frame.function,
          module: frame.module,
          filename: frame.filename,
          absPath: frame.absPath,
          lineNo: frame.lineNo,
          preContext: frame.preContext,
          contextLine: frame.contextLine,
          postContext: frame.postContext,
        };
      }),
    };
  });

  // @ts-expect-error metricSpans is defined in the old response shape
  if (data.metricSpans?.length) {
    Sentry.captureMessage('Non-empty metric spans response');
  }

  return newData;
};

const sortCodeLocations = (data: ApiResponse) => {
  const newData = {...data};
  newData.metrics = [...data.metrics].sort((a, b) => {
    return b.timestamp - a.timestamp;
  });
  return newData;
};

const deduplicateCodeLocations = (data: ApiResponse) => {
  const newData = {...data};
  newData.metrics = data.metrics.filter((element, index) => {
    return !data.metrics.slice(0, index).some(e => equalCodeLocations(e, element));
  });
  return newData;
};

const equalCodeLocations = (a: MetricMetaCodeLocation, b: MetricMetaCodeLocation) => {
  if (a.mri !== b.mri) {
    return false;
  }

  const aCodeLocation = JSON.stringify(a.codeLocations?.[0] ?? {});
  const bCodeLocation = JSON.stringify(b.codeLocations?.[0] ?? {});

  return aCodeLocation === bCodeLocation;
};
