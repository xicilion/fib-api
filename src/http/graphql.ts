import util = require('util')

import App from "../app";
import { debugFunctionWrapper } from '../utils/debug';

const graphql = require('fib-graphql');
const GraphQLJSON = require('graphql-type-json');
const GraphQLDATE = require('graphql-iso-date');

const TypeMap = {
    "serial": graphql.GraphQLInt,
    "number": graphql.GraphQLFloat,
    "integer": graphql.GraphQLInt,
    "boolean": graphql.GraphQLBoolean,
    "text": graphql.GraphQLString,
    "date": GraphQLDATE.GraphQLDateTime,
    "enum": graphql.GraphQLString,
    "object": GraphQLJSON,
    "binary": graphql.GraphQLString
};

const hasManyArgs: FibApp.FibAppApiCommnPayload_hasManyArgs = {
    where: {
        type: GraphQLJSON
    },
    skip: {
        type: graphql.GraphQLInt
    },
    limit: {
        type: graphql.GraphQLInt
    },
    order: {
        type: graphql.GraphQLString
    }
};

export = function (app: App, db: FibApp.FibAppDb) {
    var types = {};
    var graphqlTypeMap: FibApp.FibAppGraphQLTypeMap = app.__opts.graphqlTypeMap = util.extend(TypeMap, app.__opts.graphqlTypeMap)

    function get_resolve(m: FxOrmNS.FibOrmFixedModel) {
        return (
            function (parent, args, req) {
                var res = debugFunctionWrapper(app.api.get)({
                    session: req.session,
                    query: {} as FibApp.FibAppReqQuery
                }, db, m, args.id);

                if (res.error) {
                    req.error = res.error;
                    throw res.error;
                }

                return res.success;
            }
        );
    }

    function find_resolve(m: FxOrmNS.FibOrmFixedModel) {
        return (
            function (parent, args, req) {
                var res = debugFunctionWrapper(app.api.find)({
                    session: req.session,
                    query: args
                }, db, m);

                if (res.error) {
                    req.error = res.error;
                    throw res.error;
                }

                return res.success;
            }
        );
    }

    function count_resolve(m: FxOrmNS.FibOrmFixedModel) {
        return (
            function (parent, args, req) {
                args.count = 1
                args.limit = 0
                var res = debugFunctionWrapper(app.api.find)({
                    session: req.session,
                    query: args
                }, db, m);

                if (res.error) {
                    req.error = res.error;
                    throw res.error;
                }

                return res.success.count;
            }
        );
    }

    function get_resolve_one(m: FxOrmNS.FibOrmFixedModel, f: FibApp.FibAppModelExtendORMFuncName) {
        return (
            function (parent: FibApp.AppIdType, args: FibApp.FibAppReqQuery, req: FibApp.FibAppReq) {
                var res = debugFunctionWrapper(app.api.eget)({
                    session: req.session,
                    query: {} as FibApp.FibAppReqQuery
                }, db, m, parent, f);

                if (res.error) {
                    if(res.error.code === 4040002)
                        return null;

                    req.error = res.error;
                    throw res.error;
                }

                return res.success;
            }
        );
    }

    function get_resolve_many(m: FxOrmNS.FibOrmFixedModel, f: FibApp.FibAppModelExtendORMFuncName) {
        return (
            function (parent: FibApp.AppIdType, args: FibApp.FibAppReqQuery, req: FibApp.FibAppReq) {
                var res = debugFunctionWrapper(app.api.efind)({
                    session: req.session,
                    query: args
                }, db, m, parent, f);

                if (res.error) {
                    req.error = res.error;
                    throw res.error;
                }

                return res.success;
            }
        );
    }

    function get_fields(m: FxOrmNS.FibOrmFixedModel) {
        return (
            function () {
                var fields = {}

                var properties = m.properties;
                for (var p in properties) {
                    var type = graphqlTypeMap[properties[p].type]

                    if (!type) {
                        throw `valid type required for model ${m.model_name}'s field ${p}`
                    }

                    fields[p] = {
                        type: type
                    };
                }

                var _extends = m.extends;
                for (var f in _extends) {
                    var rel_model: FxOrmNS.ExtendModelWrapper = _extends[f];
                    if (!rel_model.model) {
                        throw `rel_model ${f} defined but no related model, detailed information: \n ${JSON.stringify(rel_model, null, '\t')}`
                    }
                    
                    if (rel_model.type === 'hasOne' && !rel_model.reversed)
                        fields[f] = {
                            type: types[rel_model.model.model_name].type,
                            resolve: get_resolve_one(m, f)
                        };
                    else
                        fields[f] = {
                            type: new graphql.GraphQLList(types[rel_model.model.model_name].type),
                            args: hasManyArgs,
                            resolve: get_resolve_many(m, f)
                        };
                }

                return fields;
            }
        );
    }

    for (var k in db.models) {
        var m = db.models[k];

        if (m.no_graphql) {
            continue ;
        }

        types[k] = {
            type: new graphql.GraphQLObjectType({
                name: k,
                fields: get_fields(m)
            }),
            args: {
                id: {
                    type: new graphql.GraphQLNonNull(graphql.GraphQLID),
                }
            },
            resolve: get_resolve(m)
        };

        types['find_' + k] = {
            type: new graphql.GraphQLList(types[k].type),
            args: hasManyArgs,
            resolve: find_resolve(m)
        };

        types['count_' + k] = {
            type: graphql.GraphQLInt,
            args: hasManyArgs,
            resolve: count_resolve(m)
        };
    }

    var Schema = new graphql.GraphQLSchema({
        query: new graphql.GraphQLObjectType({
            name: 'Query',
            fields: types
        })
    });

    db.graphql = (query: FibApp.GraphQLQueryString, req: FibApp.FibAppHttpRequest) => {
        var res = graphql.graphqlSync(Schema, query, {}, req);

        if (req.error) {
            var code = req.error.code;
            delete req.error;

            req.response.statusCode = code / 10000;
            res.errors[0].code = code;
        }

        return res;
    };

    return db;
};
