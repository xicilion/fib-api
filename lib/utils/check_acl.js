var util = require('util');

module.exports = function (session, act, acl, extend) {
    var aa = undefined;
    var roles = session.roles;

    function _check_acl_act(_acl_role) {
        var _aa;

        _aa = _acl_role[act];
        if (_aa !== undefined) {
            aa = _aa;
            return aa;
        }

        _aa = _acl_role['*'];
        if (_aa !== undefined) {
            aa = _aa;
            return true;
        }
    }

    function _check_acl_ext(_acl_role) {
        if (_acl_role === undefined)
            return;

        if (extend === undefined)
            return _check_acl_act(_acl_role);

        var _aa;

        var exts = _acl_role.extends;
        if (exts === undefined)
            return;

        _aa = _check_acl_act(exts[extend]);
        if (_aa !== undefined) {
            aa = _aa;
            return true;
        }

        _aa = _check_acl_act(exts['*']);
        if (_aa !== undefined) {
            aa = _aa;
            return true;
        }
    }

    if (acl === null || acl === undefined)
        return aa;

    if (util.isFunction(acl))
        acl = acl(session);

    if (acl === null || acl === undefined)
        return aa;

    if (_check_acl_ext(acl[session.id]))
        return aa;

    if (roles !== undefined) {
        var role_acls = acl.roles;

        if (role_acls !== undefined) {
            for (var i = roles.length - 1; i >= 0; i--)
                if (_check_acl_ext(role_acls[roles[i]]))
                    return aa;
        }
    }

    if (_check_acl_ext(acl['*']))
        return aa;

    return aa;
}