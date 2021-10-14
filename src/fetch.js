import axios from 'axios';
import { isObject, forEach, set, castArray, startsWith } from 'lodash';

const getEntityCount = async (reporter, apiBase, jwtToken, api) => {
  const requestOptions = {
    method: 'GET',
    url: `${apiBase}/count`,
    // Place global params first, so that they can be overriden by api.qs
    params: { ...api?.qs },
    headers: addAuthorizationHeader({}, jwtToken),
  };
  reporter.info(`Starting to count data from Strapi - ${apiBase} with params ${JSON.stringify(requestOptions.params)}`);
  try {
    const { data } = await axios(requestOptions);
    return data;
  } catch (error) {
    reporter.panic(`Failed to count data from Strapi`, error);
  }
}

module.exports = async (entityDefinition, ctx) => {
  const { apiURL, queryLimit, totalLimit, jwtToken, reporter } = ctx;

  const { endpoint, api } = entityDefinition;
  // Define API endpoint.
  let apiBase = `${apiURL}/${endpoint}`;
  const totalCount = await getEntityCount(reporter, apiBase, jwtToken, api);
  let count = totalLimit ? totalLimit : totalCount;

  reporter.info(`Fetching ${count} out of ${totalCount} items from Strapi - ${apiBase}`);

  let entities = [];
  for(let start = 0; start < count; start += api?.qs?.queryLimit || queryLimit) {
    const requestOptions = {
      method: 'GET',
      url: apiBase,
      // Place global params first, so that they can be overriden by api.qs
      params: {_limit: queryLimit, _start: start, ...api?.qs},
      headers: addAuthorizationHeader({}, jwtToken),
    };
    reporter.info(
        `Starting to fetch data from Strapi - ${apiBase} with params ${JSON.stringify(
            requestOptions.params
        )}`
    );

    try {
      const {data} = await axios(requestOptions);
      entities = entities.concat(data);
    } catch (error) {
      reporter.panic(`Failed to fetch data from Strapi`, error);
    }
  }
  return castArray(entities).map(clean);
};

/**
 * Remove fields starting with `_` symbol.
 *
 * @param {object} item - Entry needing clean
 * @returns {object} output - Object cleaned
 */
const clean = (item) => {
  forEach(item, (value, key) => {
    if (key === `__v`) {
      // Remove mongo's __v
      delete item[key];
    } else if (key === `_id`) {
      // Rename mongo's "_id" key to "id".
      delete item[key];
      item.id = value;
    } else if (startsWith(key, '__')) {
      // Gatsby reserves double-underscore prefixes – replace prefix with "strapi"
      delete item[key];
      item[`strapi_${key.slice(2)}`] = value;
    } else if (isObject(value)) {
      item[key] = clean(value);
    }
  });

  return item;
};

const addAuthorizationHeader = (options, token) => {
  if (token) {
    set(options, 'Authorization', `Bearer ${token}`);
  }

  return options;
};
