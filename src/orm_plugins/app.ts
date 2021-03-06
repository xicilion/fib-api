import { FxOrmNS } from '@fxjs/orm/typings/Typo/ORM';
import util = require('util')
import { FibApp } from '../Typo/app';
import { addReadonlyHiddenProperty } from "../utils/obj";

const error_reasons = [
    '',
    '!name',
    '!orm_definition_hash[name]',
    'definition[name].name !== name'
]
function throw_invalid_definition (name: string, error_r_key: number) {
    const error_reason = error_reasons[error_r_key]

    if (error_reason)
        throw new Error(`error occured when finding pre-define orm model ${name}, reason: ${error_reason}`)
}

function int (bool: boolean) {
    return bool ? 1 : 0
}

/**
 * @description first initial plugin before all other plugins
 */
export default function (ormInstance: FibApp.FibAppORM, opts: FxOrmNS.ModelOptions) {
    ormInstance.app = opts.app;

    const orm_definition_hash: {[model_name: string]: {
        name: string
        properties: FxOrmNS.ModelPropertyDefinitionHash
        opts: FibApp.FibAppOrmModelDefOptions
    }} = {};

    const compatibleKeys = [
        'ACL',
        'OACL',
        'functions',
        'viewFunctions',
        'viewServices',
        'no_graphql',
    ]
    function beforeDefine (name: string, properties: FxOrmNS.ModelPropertyDefinitionHash, opts: FxOrmNS.ModelOptions) {
        opts.timestamp = true

        orm_definition_hash[name] = { name, properties, opts }

        opts.webx = <FibApp.FibAppOrmModelDefOptions['webx']>util.extend(
            util.pick(opts, compatibleKeys),
            opts.webx
        );
    }
    
    let cls_id = 1;
    function define (m: FibApp.FibAppORMModel/* , ormInstance: FibApp.FibAppORM */) {
        const name = Object.keys(ormInstance.models).find(model_name => ormInstance.models[model_name] === m)
        throw_invalid_definition(
            name,
            int(!name)  + int(!orm_definition_hash[name]) + int(orm_definition_hash[name].name !== name)
        )

        const definition = orm_definition_hash[name];

        const orm_define_opts = definition.opts || {};
        /**
         * @compatibility
         *  allow webx config option from top-level definition,
         *  as those options from `opts.webx[xxx]` recommended
         */
        const webx_config_opts = orm_define_opts.webx;

        m.$webx = m.$webx || <typeof m.$webx>{
            ACL: webx_config_opts.ACL,
            OACL: webx_config_opts.OACL,
            functions: webx_config_opts.functions || {},
            viewFunctions: webx_config_opts.viewFunctions || {},
            viewServices: webx_config_opts.viewServices || {},
            no_graphql: !(webx_config_opts.no_graphql === undefined || webx_config_opts.no_graphql === false),
            
            rpc: {...webx_config_opts.rpc},
        };

        m.$webx.cid = cls_id++;
        m.$webx.model_name = name;

        if (m.$webx.ACL === undefined)
            m.$webx.ACL = {
                "*": {
                    "*": true,
                    "extends": {
                        "*": {
                            "*": true
                        }
                    }
                }
            };

        compatSetup(m);

        return m;
    }

    return {
        beforeDefine,
        define
    }
}

/**
 * @warning would deprecated in > 1.13, use `m.$webx.extends` rather than `m.extends`
 */
function compatSetup (m: FibApp.FibAppORMModel) {
    addReadonlyHiddenProperty(m, 'cid', () => m.$webx.cid)
    addReadonlyHiddenProperty(m, 'model_name', () => m.$webx.model_name)
    addReadonlyHiddenProperty(m, 'ACL', () => m.$webx.ACL)
    addReadonlyHiddenProperty(m, 'OACL', () => m.$webx.OACL)
    addReadonlyHiddenProperty(m, 'functions', () => m.$webx.functions)
    addReadonlyHiddenProperty(m, 'viewFunctions', () => m.$webx.viewFunctions)
    addReadonlyHiddenProperty(m, 'viewServices', () => m.$webx.viewServices)
    addReadonlyHiddenProperty(m, 'no_graphql', () => m.$webx.no_graphql)
}