var rest = {};

var api = {};

rest.getList = function (resource, query, user = null) {
  let json;
  let response;
  let list;
  let elementList;
  let cursor = '';
  let limit = query['limit'] ? query['limit'] : null;
  let entity = new resource['class']({});
  let names = lastPlural[entity.constructor.name];
  let endpoint = `${api.endpoint(resource['name'])}`;
  do {
    if (!query) {
      query = {};
    } else {
      for (let key in query) {
        if (Array.isArray(query[key])) {
          query[key] = query[key].join();
        }
      }
    }
    assign(query, {
      'limit': Math.min(100, limit),
      'cursor': cursor,
    });
    response = fetch(`/${endpoint}`, method = 'GET', null, query, user, 'v2');
    json = JSON.parse(response.content);
    elementList = json[api.lastName(names)];
    cursor = json['cursor'];
    if (limit) {
      limit -= 100;
    }
    for (let entity of elementList) {
      list.push(assign(new resource['class'](entity), entity));
    }
  } while (cursor);
  return list;
};

rest.post = function (resource, entities, user = null) {
  let entity = new resource['class']({});
  let names = api.lastPlural(entity.constructor.name);
  let endpoint = `${api.endpoint(resource['name'])}`;
  for (let entity of entities) {
    keys(entity).forEach(key => entity[key] === null && delete entity[key]);
  }
  let payload = {};
  payload[names] = entities;
  let response = fetch(`/${endpoint}`, 'POST', payload, null, user);
  let list = JSON.parse(response.content)[api.lastName(names)];
  let newList = [];
  for (let entity of list) {
    let newResource = new resource['class'](entity);
    newList.push(assign(newResource, entity));
  }
  return newList;
};

rest.getPdf = function (resource, id, user = null) {
  let entity = new resource['class']({});
  let name = entity.constructor.name;
  let endpoint = `${api.endpoint(resource['name'])}/${id}/pdf`;
  let response = fetchBuffer(`/${endpoint}`, 'GET', null, null, user);
  return response.content;
};

rest.getId = function (resource, id, user = null, callback) {
  let entity = new resource['class']({});
  let name = entity.constructor.name;
  let endpoint = `${api.endpoint(resource['name'])}/${id}`;
  let response = fetch(`/${endpoint}`, 'GET', null, null, user);
  let returnEntity = JSON.parse(response.content)[api.lastName(name)];
  return assign(new resource['class'](returnEntity), returnEntity);
};

rest.getPublicKey = function (user) {
  let response = fetch(path = '/public-key', 'GET', null, {'limit': 1}, user);
  return JSON.parse(response.content)['publicKeys'][0]['content'];
};

rest.deleteId = function (resource, id, user = null) {
  let entity = new resource['class']({});
  let name = entity.constructor.name;
  let endpoint = `${api.endpoint(resource['name'])}/${id}`;
  let response = fetch(`/${endpoint}`, 'DELETE', null, null, user);
  let returnEntity = JSON.parse(response.content)[api.lastName(name)];
  return assign(new resource['class'](returnEntity), returnEntity);
};

rest.postSingle = function (resource, options, user = null) {
  let entity = new resource['class']({});
  let name = api.lastName(entity.constructor.name);
  let endpoint = `${api.endpoint(resource['name'])}`;
  let payload = assign(entity, options);
  let response = fetch(`/${endpoint}`, 'POST', payload, null, user);
  let returnEntity = JSON.parse(response.content)[name];
  return assign(new resource['class'](returnEntity), returnEntity);
};

rest.patchId = function (resource, id, payload, user = null) {
  let entity = new resource['class']({});
  let name = entity.constructor.name;
  let endpoint = `${api.endpoint(resource['name'])}/${id}`;
  let response = fetch(`/${endpoint}`, 'PATCH', payload, null, user);
  let returnEntity = JSON.parse(response.content)[api.lastName(name)];
  return assign(new resource['class'](returnEntity), returnEntity);
};