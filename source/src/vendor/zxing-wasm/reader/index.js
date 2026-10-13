import { A as e, C as t, D as n, E as r, F as i, I as a, L as o, M as s, N as c, O as l, P as u, S as d, T as f, _ as p, a as m, b as h, d as g, f as _, g as v, h as y, i as ee, j as te, k as ne, l as b, m as x, n as re, o as ie, p as ae, r as oe, s as se, u as ce, v as le, w as S, x as C, y as w } from "../share.js";
//#region src/reader/zxing_reader.js
async function T(e = {}) {
	var t, n, r, i = e, a = !!globalThis.window, o = typeof Bun < "u", s = !!globalThis.WorkerGlobalScope;
	(n = globalThis.process) != null && (n = n.versions) != null && n.node && ((r = globalThis.process) == null || r.type);
	var c, l = "";
	function u(e) {
		return i.locateFile ? i.locateFile(e, l) : l + e;
	}
	var d, f;
	if (a || s || o) {
		try {
			l = new URL(".", c).href;
		} catch {}
		s && (f = (e) => {
			var t = new XMLHttpRequest();
			return t.open("GET", e, !1), t.responseType = "arraybuffer", t.send(null), new Uint8Array(t.response);
		}), d = async (e) => {
			var t = await fetch(e, { credentials: "same-origin" });
			if (t.ok) return t.arrayBuffer();
			throw Error(t.status + " : " + t.url);
		};
	}
	console.log.bind(console);
	var p = console.error.bind(console), m, h = !1, g, _, v = !1;
	function y() {
		var e = Nn.buffer;
		w = new Int8Array(e), S = new Int16Array(e), i.HEAPU8 = k = new Uint8Array(e), D = new Uint16Array(e), C = new Int32Array(e), O = new Uint32Array(e), T = new Float32Array(e), E = new Float64Array(e);
	}
	function ee() {
		if (i.preRun) for (typeof i.preRun == "function" && (i.preRun = [i.preRun]); i.preRun.length;) pe(i.preRun.shift());
		A(fe);
	}
	function te() {
		v = !0, br.sa();
	}
	function ne() {
		if (i.postRun) for (typeof i.postRun == "function" && (i.postRun = [i.postRun]); i.postRun.length;) de(i.postRun.shift());
		A(ue);
	}
	function b(e) {
		var t, n;
		(t = i.onAbort) == null || t.call(i, e), e = "Aborted(" + e + ")", p(e), h = !0, e += ". Build with -sASSERTIONS for more info.";
		var r = new WebAssembly.RuntimeError(e);
		throw (n = _) == null || n(r), r;
	}
	var x;
	function re() {
		return u("zxing_reader.wasm");
	}
	function ie(e) {
		if (e == x && m) return new Uint8Array(m);
		if (f) return f(e);
		throw "both async and sync fetching of the wasm failed";
	}
	async function ae(e) {
		if (!m) try {
			var t = await d(e);
			return new Uint8Array(t);
		} catch {}
		return ie(e);
	}
	async function oe(e, t) {
		try {
			var n = await ae(e);
			return await WebAssembly.instantiate(n, t);
		} catch (e) {
			p(`failed to asynchronously prepare wasm: ${e}`), b(e);
		}
	}
	async function se(e, t, n) {
		if (!e && WebAssembly.instantiateStreaming) try {
			var r = fetch(t, { credentials: "same-origin" });
			return await WebAssembly.instantiateStreaming(r, n);
		} catch (e) {
			p(`wasm streaming compile failed: ${e}`), p("falling back to ArrayBuffer instantiation");
		}
		return oe(t, n);
	}
	function ce() {
		return { a: In };
	}
	async function le() {
		function e(e, t) {
			return br = e.exports, Fn(br), y(), br;
		}
		function t(t) {
			return e(t.instance);
		}
		var n = ce();
		return i.instantiateWasm ? new Promise((t, r) => {
			i.instantiateWasm(n, (n, r) => {
				t(e(n, r));
			});
		}) : (x != null || (x = re()), t(await se(m, x, n)));
	}
	var S, C, w, T, E, D, O, k, A = (e) => {
		for (; e.length > 0;) e.shift()(i);
	}, ue = [], de = (e) => ue.push(e), fe = [], pe = (e) => fe.push(e), j = (e) => Dn(e), M = () => On(), me = [], he = 0, ge = (e) => {
		var t = new ve(e);
		return t.get_caught() || (t.set_caught(!0), he--), t.set_rethrown(!1), me.push(t), Tn(e);
	}, N = 0, _e = () => {
		$(0, 0);
		var e = me.pop();
		An(e.excPtr), N = 0;
	};
	class ve {
		constructor(e) {
			this.excPtr = e, this.ptr = e - 24;
		}
		set_type(e) {
			O[this.ptr + 4 >> 2] = e;
		}
		get_type() {
			return O[this.ptr + 4 >> 2];
		}
		set_destructor(e) {
			O[this.ptr + 8 >> 2] = e;
		}
		get_destructor() {
			return O[this.ptr + 8 >> 2];
		}
		set_caught(e) {
			e = +!!e, w[this.ptr + 12] = e;
		}
		get_caught() {
			return w[this.ptr + 12] != 0;
		}
		set_rethrown(e) {
			e = +!!e, w[this.ptr + 13] = e;
		}
		get_rethrown() {
			return w[this.ptr + 13] != 0;
		}
		init(e, t) {
			this.set_adjusted_ptr(0), this.set_type(e), this.set_destructor(t);
		}
		set_adjusted_ptr(e) {
			O[this.ptr + 16 >> 2] = e;
		}
		get_adjusted_ptr() {
			return O[this.ptr + 16 >> 2];
		}
	}
	var P = (e) => En(e), ye = (e) => {
		var t = N;
		if (!t) return P(0), 0;
		var n = new ve(t);
		n.set_adjusted_ptr(t);
		var r = n.get_type();
		if (!r) return P(0), t;
		for (var i of e) {
			if (i === 0 || i === r) break;
			var a = n.ptr + 16;
			if (jn(i, r, a)) return P(i), t;
		}
		return P(r), t;
	}, be = () => ye([]), xe = (e) => ye([e]), Se = (e, t) => ye([e, t]), Ce = () => {
		var e = me.pop();
		e || b("no exception to throw");
		var t = e.excPtr;
		throw e.get_rethrown() || (me.push(e), e.set_rethrown(!0), e.set_caught(!1), he++), kn(t), N = t, N;
	}, we = (e, t, n) => {
		throw new ve(e).init(t, n), kn(e), N = e, he++, N;
	}, Te = (e) => {
		throw N || (N = e), N;
	}, Ee = () => b(""), F = {}, De = (e) => {
		for (; e.length;) {
			var t = e.pop();
			e.pop()(t);
		}
	};
	function I(e) {
		return this.fromWireType(O[e >> 2]);
	}
	var L = {}, R = {}, z = {}, Oe = class extends Error {
		constructor(e) {
			super(e), this.name = "InternalError";
		}
	}, B = (e) => {
		throw new Oe(e);
	}, V = (e, t, n) => {
		e.forEach((e) => z[e] = t);
		function r(t) {
			var r = n(t);
			r.length !== e.length && B("Mismatched type converter count");
			for (var i = 0; i < e.length; ++i) G(e[i], r[i]);
		}
		var i = Array(t.length), a = [], o = 0;
		{
			let e = t;
			for (let t = 0; t < e.length; ++t) {
				let n = e[t];
				R.hasOwnProperty(n) ? i[t] = R[n] : (a.push(n), L.hasOwnProperty(n) || (L[n] = []), L[n].push(() => {
					i[t] = R[n], ++o, o === a.length && r(i);
				}));
			}
		}
		a.length === 0 && r(i);
	}, ke = (e) => {
		var t = F[e];
		delete F[e];
		var n = t.rawConstructor, r = t.rawDestructor, i = t.fields, a = i.map((e) => e.getterReturnType).concat(i.map((e) => e.setterArgumentType));
		V([e], a, (e) => {
			var a = {};
			{
				let t = i;
				for (let n = 0; n < t.length; ++n) {
					let r = t[n], o = e[n], s = r.getter, c = r.getterContext, l = e[n + i.length], u = r.setter, d = r.setterContext;
					a[r.fieldName] = {
						read: (e) => o.fromWireType(s(c, e)),
						write: (e, t) => {
							var n = [];
							u(d, e, l.toWireType(n, t)), De(n);
						},
						optional: o.optional
					};
				}
			}
			return [{
				name: t.name,
				fromWireType: (e) => {
					var t = {};
					for (var n in a) t[n] = a[n].read(e);
					return r(e), t;
				},
				toWireType: (e, t) => {
					for (var i in a) if (!(i in t) && !a[i].optional) throw TypeError(`Missing field: "${i}"`);
					var o = n();
					for (i in a) a[i].write(o, t[i]);
					return e !== null && e.push(r, o), o;
				},
				readValueFromPointer: I,
				destructorFunction: r
			}];
		});
	}, Ae = (e, t, n, r, i) => {}, H = (e) => {
		for (var t = "";;) {
			var n = k[e++];
			if (!n) return t;
			t += String.fromCharCode(n);
		}
	}, U = class extends Error {
		constructor(e) {
			super(e), this.name = "BindingError";
		}
	}, W = (e) => {
		throw new U(e);
	};
	function je(e, t) {
		let n = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : {};
		var r = t.name;
		if (e || W(`type "${r}" must have a positive integer typeid pointer`), R.hasOwnProperty(e)) {
			if (n.ignoreDuplicateRegistrations) return;
			W(`Cannot register type '${r}' twice`);
		}
		if (R[e] = t, delete z[e], L.hasOwnProperty(e)) {
			var i = L[e];
			delete L[e], i.forEach((e) => e());
		}
	}
	function G(e, t) {
		return je(e, t, arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : {});
	}
	var Me = (e, t, n, r) => {
		t = H(t), G(e, {
			name: t,
			fromWireType: function(e) {
				return !!e;
			},
			toWireType: function(e, t) {
				return t ? n : r;
			},
			readValueFromPointer: function(e) {
				return this.fromWireType(k[e]);
			},
			destructorFunction: null
		});
	}, Ne = (e) => ({
		count: e.count,
		deleteScheduled: e.deleteScheduled,
		preservePointerOnDelete: e.preservePointerOnDelete,
		ptr: e.ptr,
		ptrType: e.ptrType,
		smartPtr: e.smartPtr,
		smartPtrType: e.smartPtrType
	}), Pe = (e) => {
		function t(e) {
			return e.$$.ptrType.registeredClass.name;
		}
		W(t(e) + " instance already deleted");
	}, Fe = !1, Ie = (e) => {}, Le = (e) => {
		e.smartPtr ? e.smartPtrType.rawDestructor(e.smartPtr) : e.ptrType.registeredClass.rawDestructor(e.ptr);
	}, Re = (e) => {
		--e.count.value, e.count.value === 0 && Le(e);
	}, K = (e) => globalThis.FinalizationRegistry ? (Fe = new FinalizationRegistry((e) => {
		Re(e.$$);
	}), K = (e) => {
		var t = e.$$;
		if (t.smartPtr) {
			var n = { $$: t };
			Fe.register(e, n, e);
		}
		return e;
	}, Ie = (e) => Fe.unregister(e), K(e)) : (K = (e) => e, e), q = [], ze = () => {
		for (; q.length;) {
			var e = q.pop();
			e.$$.deleteScheduled = !1, e.delete();
		}
	}, Be, Ve = () => {
		let e = He.prototype;
		Object.assign(e, {
			isAliasOf(e) {
				if (!(this instanceof He) || !(e instanceof He)) return !1;
				var t = this.$$.ptrType.registeredClass, n = this.$$.ptr;
				e.$$ = e.$$;
				for (var r = e.$$.ptrType.registeredClass, i = e.$$.ptr; t.baseClass;) n = t.upcast(n), t = t.baseClass;
				for (; r.baseClass;) i = r.upcast(i), r = r.baseClass;
				return t === r && n === i;
			},
			clone() {
				if (this.$$.ptr || Pe(this), this.$$.preservePointerOnDelete) return this.$$.count.value += 1, this;
				var e = K(Object.create(Object.getPrototypeOf(this), { $$: { value: Ne(this.$$) } }));
				return e.$$.count.value += 1, e.$$.deleteScheduled = !1, e;
			},
			delete() {
				this.$$.ptr || Pe(this), this.$$.deleteScheduled && !this.$$.preservePointerOnDelete && W("Object already scheduled for deletion"), Ie(this), Re(this.$$), this.$$.preservePointerOnDelete || (this.$$.smartPtr = void 0, this.$$.ptr = void 0);
			},
			isDeleted() {
				return !this.$$.ptr;
			},
			deleteLater() {
				return this.$$.ptr || Pe(this), this.$$.deleteScheduled && !this.$$.preservePointerOnDelete && W("Object already scheduled for deletion"), q.push(this), q.length === 1 && Be && Be(ze), this.$$.deleteScheduled = !0, this;
			}
		});
		let t = Symbol.dispose;
		t && (e[t] = e.delete);
	};
	function He() {}
	var Ue = (e, t) => Object.defineProperty(t, "name", { value: e }), We = {}, Ge = (e, t, n) => {
		if (e[t].overloadTable === void 0) {
			var r = e[t];
			e[t] = function() {
				var r = [...arguments];
				return e[t].overloadTable.hasOwnProperty(r.length) || W(`Function '${n}' called with an invalid number of arguments (${r.length}) - expects one of (${e[t].overloadTable})!`), e[t].overloadTable[r.length].apply(this, r);
			}, e[t].overloadTable = [], e[t].overloadTable[r.argCount] = r;
		}
	}, Ke = (e, t, n) => {
		i.hasOwnProperty(e) ? ((n === void 0 || i[e].overloadTable !== void 0 && i[e].overloadTable[n] !== void 0) && W(`Cannot register public name '${e}' twice`), Ge(i, e, e), i[e].overloadTable.hasOwnProperty(n) && W(`Cannot register multiple overloads of a function with the same number of arguments (${n})!`), i[e].overloadTable[n] = t) : (i[e] = t, i[e].argCount = n);
	}, qe = 48, Je = 57, Ye = (e) => {
		e = e.replace(/[^a-zA-Z0-9_]/g, "$");
		var t = e.charCodeAt(0);
		return t >= qe && t <= Je ? `_${e}` : e;
	};
	function Xe(e, t, n, r, i, a, o, s) {
		this.name = e, this.constructor = t, this.instancePrototype = n, this.rawDestructor = r, this.baseClass = i, this.getActualType = a, this.upcast = o, this.downcast = s, this.pureVirtualFunctions = [];
	}
	var Ze = (e, t, n) => {
		for (; t !== n;) t.upcast || W(`Expected null or instance of ${n.name}, got an instance of ${t.name}`), e = t.upcast(e), t = t.baseClass;
		return e;
	}, Qe = (e) => {
		if (e === null) return "null";
		var t = typeof e;
		return t === "object" || t === "array" || t === "function" ? e.toString() : "" + e;
	};
	function $e(e, t) {
		if (t === null) return this.isReference && W(`null is not a valid ${this.name}`), 0;
		t.$$ || W(`Cannot pass "${Qe(t)}" as a ${this.name}`), t.$$.ptr || W(`Cannot pass deleted object as a pointer of type ${this.name}`);
		var n = t.$$.ptrType.registeredClass;
		return Ze(t.$$.ptr, n, this.registeredClass);
	}
	function et(e, t) {
		var n;
		if (t === null) return this.isReference && W(`null is not a valid ${this.name}`), this.isSmartPointer ? (n = this.rawConstructor(), e !== null && e.push(this.rawDestructor, n), n) : 0;
		(!t || !t.$$) && W(`Cannot pass "${Qe(t)}" as a ${this.name}`), t.$$.ptr || W(`Cannot pass deleted object as a pointer of type ${this.name}`), !this.isConst && t.$$.ptrType.isConst && W(`Cannot convert argument of type ${t.$$.smartPtrType ? t.$$.smartPtrType.name : t.$$.ptrType.name} to parameter type ${this.name}`);
		var r = t.$$.ptrType.registeredClass;
		if (n = Ze(t.$$.ptr, r, this.registeredClass), this.isSmartPointer) switch (t.$$.smartPtr === void 0 && W("Passing raw pointer to smart pointer is illegal"), this.sharingPolicy) {
			case 0:
				t.$$.smartPtrType === this ? n = t.$$.smartPtr : W(`Cannot convert argument of type ${t.$$.smartPtrType ? t.$$.smartPtrType.name : t.$$.ptrType.name} to parameter type ${this.name}`);
				break;
			case 1:
				n = t.$$.smartPtr;
				break;
			case 2:
				if (t.$$.smartPtrType === this) n = t.$$.smartPtr;
				else {
					var i = t.clone();
					n = this.rawShare(n, Z.toHandle(() => i.delete())), e !== null && e.push(this.rawDestructor, n);
				}
				break;
			default: W("Unsupported sharing policy");
		}
		return n;
	}
	function tt(e, t) {
		if (t === null) return this.isReference && W(`null is not a valid ${this.name}`), 0;
		t.$$ || W(`Cannot pass "${Qe(t)}" as a ${this.name}`), t.$$.ptr || W(`Cannot pass deleted object as a pointer of type ${this.name}`), t.$$.ptrType.isConst && W(`Cannot convert argument of type ${t.$$.ptrType.name} to parameter type ${this.name}`);
		var n = t.$$.ptrType.registeredClass;
		return Ze(t.$$.ptr, n, this.registeredClass);
	}
	var nt = (e, t, n) => {
		if (t === n) return e;
		if (n.baseClass === void 0) return null;
		var r = nt(e, t, n.baseClass);
		return r === null ? null : n.downcast(r);
	}, rt = {}, it = (e, t) => {
		for (t === void 0 && W("ptr should not be undefined"); e.baseClass;) t = e.upcast(t), e = e.baseClass;
		return t;
	}, at = (e, t) => (t = it(e, t), rt[t]), ot = (e, t) => ((!t.ptrType || !t.ptr) && B("makeClassHandle requires ptr and ptrType"), !!t.smartPtrType != !!t.smartPtr && B("Both smartPtrType and smartPtr must be specified"), t.count = { value: 1 }, K(Object.create(e, { $$: {
		value: t,
		writable: !0
	} })));
	function st(e) {
		var t = this.getPointee(e);
		if (!t) return this.destructor(e), null;
		var n = at(this.registeredClass, t);
		if (n !== void 0) {
			if (n.$$.count.value === 0) return n.$$.ptr = t, n.$$.smartPtr = e, n.clone();
			var r = n.clone();
			return this.destructor(e), r;
		}
		function i() {
			return this.isSmartPointer ? ot(this.registeredClass.instancePrototype, {
				ptrType: this.pointeeType,
				ptr: t,
				smartPtrType: this,
				smartPtr: e
			}) : ot(this.registeredClass.instancePrototype, {
				ptrType: this,
				ptr: e
			});
		}
		var a = We[this.registeredClass.getActualType(t)];
		if (!a) return i.call(this);
		var o = this.isConst ? a.constPointerType : a.pointerType, s = nt(t, this.registeredClass, o.registeredClass);
		return s === null ? i.call(this) : this.isSmartPointer ? ot(o.registeredClass.instancePrototype, {
			ptrType: o,
			ptr: s,
			smartPtrType: this,
			smartPtr: e
		}) : ot(o.registeredClass.instancePrototype, {
			ptrType: o,
			ptr: s
		});
	}
	var ct = () => {
		Object.assign(lt.prototype, {
			getPointee(e) {
				return this.rawGetPointee && (e = this.rawGetPointee(e)), e;
			},
			destructor(e) {
				var t;
				(t = this.rawDestructor) == null || t.call(this, e);
			},
			readValueFromPointer: I,
			fromWireType: st
		});
	};
	function lt(e, t, n, r, i, a, o, s, c, l, u) {
		this.name = e, this.registeredClass = t, this.isReference = n, this.isConst = r, this.isSmartPointer = i, this.pointeeType = a, this.sharingPolicy = o, this.rawGetPointee = s, this.rawConstructor = c, this.rawShare = l, this.rawDestructor = u, !i && t.baseClass === void 0 ? r ? (this.toWireType = $e, this.destructorFunction = null) : (this.toWireType = tt, this.destructorFunction = null) : this.toWireType = et;
	}
	var ut = (e, t, n) => {
		i.hasOwnProperty(e) || B("Replacing nonexistent public symbol"), i[e].overloadTable !== void 0 && n !== void 0 ? i[e].overloadTable[n] = t : (i[e] = t, i[e].argCount = n);
	}, dt = {}, ft = (e, t, n) => {
		e = e.replace(/p/g, "i");
		var r = dt[e];
		return r(t, ...n);
	}, pt = [], J = (e) => {
		var t = pt[e];
		return t || (pt[e] = t = Pn.get(e)), t;
	}, mt = function(e, t) {
		let n = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : [];
		if (arguments.length > 3 && arguments[3] !== void 0 && arguments[3], e.includes("j")) return ft(e, t, n);
		var r = J(t)(...n);
		function i(e) {
			return e;
		}
		return i(r);
	}, ht = function(e, t) {
		let n = arguments.length > 2 && arguments[2] !== void 0 && arguments[2];
		return function() {
			return mt(e, t, [...arguments], n);
		};
	}, Y = function(e, t) {
		arguments.length > 2 && arguments[2] !== void 0 && arguments[2], e = H(e);
		function n() {
			return e.includes("j") ? ht(e, t) : J(t);
		}
		var r = n();
		return typeof r != "function" && W(`unknown function pointer with signature ${e}: ${t}`), r;
	};
	class gt extends Error {}
	var _t = (e) => {
		var t = Cn(e), n = H(t);
		return Q(t), n;
	}, vt = (e, t) => {
		var n = [], r = {};
		function i(e) {
			if (!r[e] && !R[e]) {
				if (z[e]) {
					z[e].forEach(i);
					return;
				}
				n.push(e), r[e] = !0;
			}
		}
		throw t.forEach(i), new gt(`${e}: ` + n.map(_t).join([", "]));
	}, yt = (e, t, n, r, i, a, o, s, c, l, u, d, f) => {
		u = H(u), a = Y(i, a), s && (s = Y(o, s)), l && (l = Y(c, l)), f = Y(d, f);
		var p = Ye(u);
		Ke(p, function() {
			vt(`Cannot construct ${u} due to unbound types`, [r]);
		}), V([
			e,
			t,
			n
		], r ? [r] : [], (t) => {
			t = t[0];
			var n, i;
			r ? (n = t.registeredClass, i = n.instancePrototype) : i = He.prototype;
			var o = Ue(u, function() {
				if (Object.getPrototypeOf(this) !== c) throw new U(`Use 'new' to construct ${u}`);
				if (d.constructor_body === void 0) throw new U(`${u} has no accessible constructor`);
				var e = [...arguments], t = d.constructor_body[e.length];
				if (t === void 0) throw new U(`Tried to invoke ctor of ${u} with invalid number of parameters (${e.length}) - expected (${Object.keys(d.constructor_body).toString()}) parameters instead!`);
				return t.apply(this, e);
			}), c = Object.create(i, { constructor: { value: o } });
			o.prototype = c;
			var d = new Xe(u, o, c, f, n, a, s, l);
			if (d.baseClass) {
				var m;
				(m = d.baseClass).__derivedClasses != null || (m.__derivedClasses = []), d.baseClass.__derivedClasses.push(d);
			}
			var h = new lt(u, d, !0, !1, !1), g = new lt(u + "*", d, !1, !1, !1), _ = new lt(u + " const*", d, !1, !0, !1);
			return We[e] = {
				pointerType: g,
				constPointerType: _
			}, ut(p, o), [
				h,
				g,
				_
			];
		});
	}, bt = (e, t) => {
		for (var n = [], r = 0; r < e; r++) n.push(O[t + r * 4 >> 2]);
		return n;
	};
	function xt(e) {
		for (var t = 1; t < e.length; ++t) if (e[t] !== null && e[t].destructorFunction === void 0) return !0;
		return !1;
	}
	function St(e, t, n, r, i, a) {
		var o = t.length;
		o < 2 && W("argTypes array size mismatch! Must at least get return value and 'this' types!");
		var s = t[1] !== null && n !== null, c = xt(t), l = !t[0].isVoid, u = o - 2, d = Array(u), f = [], p = [];
		return Ue(e, function() {
			p.length = 0;
			var e;
			f.length = s ? 2 : 1, f[0] = i, s && (e = t[1].toWireType(p, this), f[1] = e);
			for (var n = 0; n < u; ++n) d[n] = t[n + 2].toWireType(p, n < 0 || arguments.length <= n ? void 0 : arguments[n]), f.push(d[n]);
			var a = r(...f);
			function o(n) {
				if (c) De(p);
				else for (var r = s ? 1 : 2; r < t.length; r++) {
					var i = r === 1 ? e : d[r - 2];
					t[r].destructorFunction !== null && t[r].destructorFunction(i);
				}
				if (l) return t[0].fromWireType(n);
			}
			return o(a);
		});
	}
	var Ct = (e, t, n, r, i, a) => {
		var o = bt(t, n);
		i = Y(r, i), V([], [e], (e) => {
			e = e[0];
			var n = `constructor ${e.name}`;
			if (e.registeredClass.constructor_body === void 0 && (e.registeredClass.constructor_body = []), e.registeredClass.constructor_body[t - 1] !== void 0) throw new U(`Cannot register multiple constructors with identical number of parameters (${t - 1}) for class '${e.name}'! Overload resolution is currently only performed using the parameter count, not actual type info!`);
			return e.registeredClass.constructor_body[t - 1] = () => {
				vt(`Cannot construct ${e.name} due to unbound types`, o);
			}, V([], o, (r) => (r.splice(1, 0, null), e.registeredClass.constructor_body[t - 1] = St(n, r, null, i, a), [])), [];
		});
	}, wt = (e) => {
		e = e.trim();
		let t = e.indexOf("(");
		return t === -1 ? e : e.slice(0, t);
	}, Tt = (e, t, n, r, i, a, o, s, c, l) => {
		var u = bt(n, r);
		t = H(t), t = wt(t), a = Y(i, a, c), V([], [e], (e) => {
			e = e[0];
			var r = `${e.name}.${t}`;
			t.startsWith("@@") && (t = Symbol[t.substring(2)]), s && e.registeredClass.pureVirtualFunctions.push(t);
			function i() {
				vt(`Cannot call ${r} due to unbound types`, u);
			}
			var l = e.registeredClass.instancePrototype, d = l[t];
			return d === void 0 || d.overloadTable === void 0 && d.className !== e.name && d.argCount === n - 2 ? (i.argCount = n - 2, i.className = e.name, l[t] = i) : (Ge(l, t, r), l[t].overloadTable[n - 2] = i), V([], u, (i) => {
				var s = St(r, i, e, a, o, c);
				return l[t].overloadTable === void 0 ? (s.argCount = n - 2, l[t] = s) : l[t].overloadTable[n - 2] = s, [];
			}), [];
		});
	}, Et = [], X = [
		0,
		1,
		,
		1,
		null,
		1,
		!0,
		1,
		!1,
		1
	], Dt = (e) => {
		e > 9 && --X[e + 1] === 0 && (X[e] = void 0, Et.push(e));
	}, Z = {
		toValue: (e) => (e || W(`Cannot use deleted val. handle = ${e}`), X[e]),
		toHandle: (e) => {
			switch (e) {
				case void 0: return 2;
				case null: return 4;
				case !0: return 6;
				case !1: return 8;
				default: {
					let t = Et.pop() || X.length;
					return X[t] = e, X[t + 1] = 1, t;
				}
			}
		}
	}, Ot = {
		name: "emscripten::val",
		fromWireType: (e) => {
			var t = Z.toValue(e);
			return Dt(e), t;
		},
		toWireType: (e, t) => Z.toHandle(t),
		readValueFromPointer: I,
		destructorFunction: null
	}, kt = (e) => G(e, Ot), At = (e, t) => {
		switch (t) {
			case 4: return function(e) {
				return this.fromWireType(T[e >> 2]);
			};
			case 8: return function(e) {
				return this.fromWireType(E[e >> 3]);
			};
			default: throw TypeError(`invalid float width (${t}): ${e}`);
		}
	}, jt = (e, t, n) => {
		t = H(t), G(e, {
			name: t,
			fromWireType: (e) => e,
			toWireType: (e, t) => t,
			readValueFromPointer: At(t, n),
			destructorFunction: null
		});
	}, Mt = (e, t, n, r, i, a, o, s) => {
		var c = bt(t, n);
		e = H(e), e = wt(e), i = Y(r, i, o), Ke(e, function() {
			vt(`Cannot call ${e} due to unbound types`, c);
		}, t - 1), V([], c, (n) => {
			var r = [n[0], null].concat(n.slice(1));
			return ut(e, St(e, r, null, i, a, o), t - 1), [];
		});
	}, Nt = (e, t, n) => {
		switch (t) {
			case 1: return n ? (e) => w[e] : (e) => k[e];
			case 2: return n ? (e) => S[e >> 1] : (e) => D[e >> 1];
			case 4: return n ? (e) => C[e >> 2] : (e) => O[e >> 2];
			default: throw TypeError(`invalid integer width (${t}): ${e}`);
		}
	}, Pt = (e, t, n, r, i) => {
		t = H(t);
		let a = r === 0, o = (e) => e;
		if (a) {
			var s = 32 - 8 * n;
			o = (e) => e << s >>> s, i = o(i);
		}
		G(e, {
			name: t,
			fromWireType: o,
			toWireType: (e, t) => t,
			readValueFromPointer: Nt(t, n, r !== 0),
			destructorFunction: null
		});
	}, Ft = (e, t, n) => {
		let r = (e, t) => {
			let n = 0;
			return {
				next() {
					if (n >= e) return { done: !0 };
					let r = n;
					return n++, {
						value: t(r),
						done: !1
					};
				},
				[Symbol.iterator]() {
					return this;
				}
			};
		};
		e[Symbol.iterator] || (e[Symbol.iterator] = function() {
			let e = this[t]();
			return r(e, (e) => this[n](e));
		});
	}, It = (e, t, n, r) => {
		n = H(n), r = H(r), V([], [e, t], (e) => {
			let t = e[0];
			return Ft(t.registeredClass.instancePrototype, n, r), [];
		});
	}, Lt = (e, t, n) => {
		var r = [
			Int8Array,
			Uint8Array,
			Int16Array,
			Uint16Array,
			Int32Array,
			Uint32Array,
			Float32Array,
			Float64Array
		][t];
		function i(e) {
			var t = O[e >> 2], n = O[e + 4 >> 2];
			return new r(w.buffer, n, t);
		}
		n = H(n), G(e, {
			name: n,
			fromWireType: i,
			readValueFromPointer: i
		}, { ignoreDuplicateRegistrations: !0 });
	}, Rt = Object.assign({ optional: !0 }, Ot), zt = (e, t) => {
		G(e, Rt);
	}, Bt = (e, t, n, r) => {
		if (!(r > 0)) return 0;
		for (var i = n, a = n + r - 1, o = 0; o < e.length; ++o) {
			var s = e.codePointAt(o);
			if (s <= 127) {
				if (n >= a) break;
				t[n++] = s;
			} else if (s <= 2047) {
				if (n + 1 >= a) break;
				t[n++] = 192 | s >> 6, t[n++] = 128 | s & 63;
			} else if (s <= 65535) {
				if (n + 2 >= a) break;
				t[n++] = 224 | s >> 12, t[n++] = 128 | s >> 6 & 63, t[n++] = 128 | s & 63;
			} else {
				if (n + 3 >= a) break;
				t[n++] = 240 | s >> 18, t[n++] = 128 | s >> 12 & 63, t[n++] = 128 | s >> 6 & 63, t[n++] = 128 | s & 63, o++;
			}
		}
		return t[n] = 0, n - i;
	}, Vt = (e, t, n) => Bt(e, k, t, n), Ht = (e) => {
		for (var t = 0, n = 0; n < e.length; ++n) {
			var r = e.charCodeAt(n);
			r <= 127 ? t++ : r <= 2047 ? t += 2 : r >= 55296 && r <= 57343 ? (t += 4, ++n) : t += 3;
		}
		return t;
	}, Ut = globalThis.TextDecoder && new TextDecoder(), Wt = (e, t, n, r) => {
		var i = t + n;
		if (r) return i;
		for (; e[t] && !(t >= i);) ++t;
		return t;
	}, Gt = function(e) {
		let t = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 0, n = arguments.length > 2 ? arguments[2] : void 0, r = arguments.length > 3 ? arguments[3] : void 0;
		var i = Wt(e, t, n, r);
		if (i - t > 16 && e.buffer && Ut) return Ut.decode(e.subarray(t, i));
		for (var a = ""; t < i;) {
			var o = e[t++];
			if (!(o & 128)) {
				a += String.fromCharCode(o);
				continue;
			}
			var s = e[t++] & 63;
			if ((o & 224) == 192) {
				a += String.fromCharCode((o & 31) << 6 | s);
				continue;
			}
			var c = e[t++] & 63;
			if (o = (o & 240) == 224 ? (o & 15) << 12 | s << 6 | c : (o & 7) << 18 | s << 12 | c << 6 | e[t++] & 63, o < 65536) a += String.fromCharCode(o);
			else {
				var l = o - 65536;
				a += String.fromCharCode(55296 | l >> 10, 56320 | l & 1023);
			}
		}
		return a;
	}, Kt = (e, t, n) => e ? Gt(k, e, t, n) : "", qt = (e, t) => {
		t = H(t);
		var n = !0;
		G(e, {
			name: t,
			fromWireType(e) {
				var t = O[e >> 2], r = e + 4, i;
				if (n) i = Kt(r, t, !0);
				else {
					i = "";
					for (var a = 0; a < t; ++a) i += String.fromCharCode(k[r + a]);
				}
				return Q(e), i;
			},
			toWireType(e, t) {
				t instanceof ArrayBuffer && (t = new Uint8Array(t));
				var r, i = typeof t == "string";
				i || ArrayBuffer.isView(t) && t.BYTES_PER_ELEMENT == 1 || W("Cannot pass non-string to std::string"), r = n && i ? Ht(t) : t.length;
				var a = wn(4 + r + 1), o = a + 4;
				if (O[a >> 2] = r, i) {
					if (n) Vt(t, o, r + 1);
					else for (var s = 0; s < r; ++s) {
						var c = t.charCodeAt(s);
						c > 255 && (Q(a), W("String has UTF-16 code units that do not fit in 8 bits")), k[o + s] = c;
					}
				} else k.set(t, o);
				return e !== null && e.push(Q, a), a;
			},
			readValueFromPointer: I,
			destructorFunction(e) {
				Q(e);
			}
		});
	}, Jt = globalThis.TextDecoder ? new TextDecoder("utf-16le") : void 0, Yt = (e, t, n) => {
		var r = e >> 1, i = Wt(D, r, t / 2, n);
		if (i - r > 16 && Jt) return Jt.decode(D.subarray(r, i));
		for (var a = "", o = r; o < i; ++o) {
			var s = D[o];
			a += String.fromCharCode(s);
		}
		return a;
	}, Xt = (e, t, n) => {
		if (n != null || (n = 2147483647), n < 2) return 0;
		n -= 2;
		for (var r = t, i = n < e.length * 2 ? n / 2 : e.length, a = 0; a < i; ++a) {
			var o = e.charCodeAt(a);
			S[t >> 1] = o, t += 2;
		}
		return S[t >> 1] = 0, t - r;
	}, Zt = (e) => e.length * 2, Qt = (e, t, n) => {
		for (var r = "", i = e >> 2, a = 0; !(a >= t / 4); a++) {
			var o = O[i + a];
			if (!o && !n) break;
			r += String.fromCodePoint(o);
		}
		return r;
	}, $t = (e, t, n) => {
		if (n != null || (n = 2147483647), n < 4) return 0;
		for (var r = t, i = r + n - 4, a = 0; a < e.length; ++a) {
			var o = e.codePointAt(a);
			if (o > 65535 && a++, C[t >> 2] = o, t += 4, t + 4 > i) break;
		}
		return C[t >> 2] = 0, t - r;
	}, en = (e) => {
		for (var t = 0, n = 0; n < e.length; ++n) e.codePointAt(n) > 65535 && n++, t += 4;
		return t;
	}, tn = (e, t, n) => {
		n = H(n);
		var r, i, a;
		t === 2 ? (r = Yt, i = Xt, a = Zt) : (r = Qt, i = $t, a = en), G(e, {
			name: n,
			fromWireType: (e) => {
				var n = O[e >> 2], i = r(e + 4, n * t, !0);
				return Q(e), i;
			},
			toWireType: (e, r) => {
				typeof r != "string" && W(`Cannot pass non-string to C++ string type ${n}`);
				var o = a(r), s = wn(4 + o + t);
				return O[s >> 2] = o / t, i(r, s + 4, o + t), e !== null && e.push(Q, s), s;
			},
			readValueFromPointer: I,
			destructorFunction(e) {
				Q(e);
			}
		});
	}, nn = (e, t, n, r, i, a) => {
		F[e] = {
			name: H(t),
			rawConstructor: Y(n, r),
			rawDestructor: Y(i, a),
			fields: []
		};
	}, rn = (e, t, n, r, i, a, o, s, c, l) => {
		F[e].fields.push({
			fieldName: H(t),
			getterReturnType: n,
			getter: Y(r, i),
			getterContext: a,
			setterArgumentType: o,
			setter: Y(s, c),
			setterContext: l
		});
	}, an = (e, t) => {
		t = H(t), G(e, {
			isVoid: !0,
			name: t,
			fromWireType: () => void 0,
			toWireType: (e, t) => void 0
		});
	}, on = [], sn = (e) => {
		var t = on.length;
		return on.push(e), t;
	}, cn = (e, t) => {
		var n = R[e];
		return n === void 0 && W(`${t} has unknown type ${_t(e)}`), n;
	}, ln = (e, t) => {
		for (var n = Array(e), r = 0; r < e; ++r) n[r] = cn(O[t + r * 4 >> 2], `parameter ${r}`);
		return n;
	}, un = (e, t, n) => {
		var r = [], i = e(r, n);
		return r.length && (O[t >> 2] = Z.toHandle(r)), i;
	}, dn = {}, fn = (e) => {
		var t = dn[e];
		return t === void 0 ? H(e) : t;
	}, pn = (e, t, n) => {
		var [r, ...i] = ln(e, t), a = r.toWireType.bind(r), o = i.map((e) => e.readValueFromPointer.bind(e));
		e--;
		var s = Array(e);
		return sn(Ue(`methodCaller<(${i.map((e) => e.name)}) => ${r.name}>`, (t, r, i, c) => {
			for (var l = 0, u = 0; u < e; ++u) s[u] = o[u](c + l), l += 8;
			var d;
			switch (n) {
				case 0:
					d = Z.toValue(t).apply(null, s);
					break;
				case 2:
					d = Reflect.construct(Z.toValue(t), s);
					break;
				case 3:
					d = s[0];
					break;
				case 1: d = Z.toValue(t)[fn(r)](...s);
			}
			return un(a, i, d);
		}));
	}, mn = (e) => e ? (e = fn(e), Z.toHandle(globalThis[e])) : Z.toHandle(globalThis), hn = (e) => {
		e > 9 && (X[e + 1] += 1);
	}, gn = (e, t, n, r, i) => on[e](t, n, r, i), _n = (e) => {
		De(Z.toValue(e)), Dt(e);
	}, vn = () => 2147483648, yn = (e, t) => Math.ceil(e / t) * t, bn = (e) => {
		var t = (e - Nn.buffer.byteLength + 65535) / 65536 | 0;
		try {
			return Nn.grow(t), y(), 1;
		} catch {}
	}, xn = (e) => {
		var t = k.length;
		e >>>= 0;
		var n = vn();
		if (e > n) return !1;
		for (var r = 1; r <= 4; r *= 2) {
			var i = t * (1 + .2 / r);
			if (i = Math.min(i, e + 100663296), bn(Math.min(n, yn(Math.max(e, i), 65536)))) return !0;
		}
		return !1;
	}, Sn = (e) => e;
	if (Ve(), ct(), i.noExitRuntime && i.noExitRuntime, i.print && i.print, i.printErr && (p = i.printErr), i.wasmBinary && (m = i.wasmBinary), i.arguments && i.arguments, i.thisProgram && i.thisProgram, i.preInit) for (typeof i.preInit == "function" && (i.preInit = [i.preInit]); i.preInit.length > 0;) i.preInit.shift()();
	var Cn, Q, wn, Tn, $, En, Dn, On, kn, An, jn, Mn, Nn, Pn;
	function Fn(e) {
		Cn = e.ta, Q = i._free = e.ua, wn = i._malloc = e.wa, Tn = e.xa, $ = e.ya, En = e.za, Dn = e.Aa, On = e.Ba, kn = e.Ca, An = e.Da, jn = e.Ea, Mn = dt.iiijj = e.Fa, Nn = e.ra, Pn = e.va;
	}
	var In = {
		s: ge,
		H: _e,
		a: be,
		i: xe,
		l: Se,
		S: Ce,
		r: we,
		e: Te,
		Y: Ee,
		oa: ke,
		X: Ae,
		ia: Me,
		ma: yt,
		la: Ct,
		C: Tt,
		ga: kt,
		U: jt,
		V: Mt,
		w: Pt,
		ka: It,
		t: Lt,
		na: zt,
		ha: qt,
		O: tn,
		D: nn,
		pa: rn,
		ja: an,
		G: pn,
		qa: Dt,
		A: mn,
		P: hn,
		F: gn,
		aa: _n,
		Z: xn,
		fa: qn,
		ca: ar,
		R: cr,
		y: pr,
		I: Wn,
		b: zn,
		z: sr,
		$: dr,
		d: Vn,
		L: fr,
		h: Un,
		j: Zn,
		p: Qn,
		M: or,
		T: tr,
		N: er,
		K: mr,
		da: rr,
		W: vr,
		c: Gn,
		m: Ln,
		_: hr,
		g: Bn,
		Q: lr,
		J: _r,
		f: Hn,
		E: gr,
		k: Rn,
		ba: ur,
		n: $n,
		u: Jn,
		B: ir,
		x: Xn,
		q: nr,
		o: Kn,
		ea: Yn,
		v: Sn
	};
	function Ln(e, t) {
		var n = M();
		try {
			J(e)(t);
		} catch (e) {
			if (j(n), e !== e + 0) throw e;
			$(1, 0);
		}
	}
	function Rn(e, t, n, r, i) {
		var a = M();
		try {
			J(e)(t, n, r, i);
		} catch (e) {
			if (j(a), e !== e + 0) throw e;
			$(1, 0);
		}
	}
	function zn(e, t) {
		var n = M();
		try {
			return J(e)(t);
		} catch (e) {
			if (j(n), e !== e + 0) throw e;
			$(1, 0);
		}
	}
	function Bn(e, t, n) {
		var r = M();
		try {
			J(e)(t, n);
		} catch (e) {
			if (j(r), e !== e + 0) throw e;
			$(1, 0);
		}
	}
	function Vn(e, t, n) {
		var r = M();
		try {
			return J(e)(t, n);
		} catch (e) {
			if (j(r), e !== e + 0) throw e;
			$(1, 0);
		}
	}
	function Hn(e, t, n, r) {
		var i = M();
		try {
			J(e)(t, n, r);
		} catch (e) {
			if (j(i), e !== e + 0) throw e;
			$(1, 0);
		}
	}
	function Un(e, t, n, r) {
		var i = M();
		try {
			return J(e)(t, n, r);
		} catch (e) {
			if (j(i), e !== e + 0) throw e;
			$(1, 0);
		}
	}
	function Wn(e, t, n, r, i, a) {
		var o = M();
		try {
			return J(e)(t, n, r, i, a);
		} catch (e) {
			if (j(o), e !== e + 0) throw e;
			$(1, 0);
		}
	}
	function Gn(e) {
		var t = M();
		try {
			J(e)();
		} catch (e) {
			if (j(t), e !== e + 0) throw e;
			$(1, 0);
		}
	}
	function Kn(e, t, n, r, i, a, o, s, c, l, u) {
		var d = M();
		try {
			J(e)(t, n, r, i, a, o, s, c, l, u);
		} catch (e) {
			if (j(d), e !== e + 0) throw e;
			$(1, 0);
		}
	}
	function qn(e, t) {
		var n = M();
		try {
			return J(e)(t);
		} catch (e) {
			if (j(n), e !== e + 0) throw e;
			$(1, 0);
		}
	}
	function Jn(e, t, n, r, i, a, o) {
		var s = M();
		try {
			J(e)(t, n, r, i, a, o);
		} catch (e) {
			if (j(s), e !== e + 0) throw e;
			$(1, 0);
		}
	}
	function Yn(e, t, n, r, i, a, o, s, c, l, u, d, f, p, m, h, g, _, v, y, ee, te, ne, b) {
		var x = M();
		try {
			J(e)(t, n, r, i, a, o, s, c, l, u, d, f, p, m, h, g, _, v, y, ee, te, ne, b);
		} catch (e) {
			if (j(x), e !== e + 0) throw e;
			$(1, 0);
		}
	}
	function Xn(e, t, n, r, i, a, o, s, c) {
		var l = M();
		try {
			J(e)(t, n, r, i, a, o, s, c);
		} catch (e) {
			if (j(l), e !== e + 0) throw e;
			$(1, 0);
		}
	}
	function Zn(e, t, n, r, i) {
		var a = M();
		try {
			return J(e)(t, n, r, i);
		} catch (e) {
			if (j(a), e !== e + 0) throw e;
			$(1, 0);
		}
	}
	function Qn(e, t, n, r, i, a) {
		var o = M();
		try {
			return J(e)(t, n, r, i, a);
		} catch (e) {
			if (j(o), e !== e + 0) throw e;
			$(1, 0);
		}
	}
	function $n(e, t, n, r, i, a) {
		var o = M();
		try {
			J(e)(t, n, r, i, a);
		} catch (e) {
			if (j(o), e !== e + 0) throw e;
			$(1, 0);
		}
	}
	function er(e, t, n, r, i, a, o, s) {
		var c = M();
		try {
			return J(e)(t, n, r, i, a, o, s);
		} catch (e) {
			if (j(c), e !== e + 0) throw e;
			$(1, 0);
		}
	}
	function tr(e, t, n, r, i, a, o) {
		var s = M();
		try {
			return J(e)(t, n, r, i, a, o);
		} catch (e) {
			if (j(s), e !== e + 0) throw e;
			$(1, 0);
		}
	}
	function nr(e, t, n, r, i, a, o, s, c, l) {
		var u = M();
		try {
			J(e)(t, n, r, i, a, o, s, c, l);
		} catch (e) {
			if (j(u), e !== e + 0) throw e;
			$(1, 0);
		}
	}
	function rr(e, t, n, r, i, a, o, s, c, l) {
		var u = M();
		try {
			return J(e)(t, n, r, i, a, o, s, c, l);
		} catch (e) {
			if (j(u), e !== e + 0) throw e;
			$(1, 0);
		}
	}
	function ir(e, t, n, r, i, a, o, s) {
		var c = M();
		try {
			J(e)(t, n, r, i, a, o, s);
		} catch (e) {
			if (j(c), e !== e + 0) throw e;
			$(1, 0);
		}
	}
	function ar(e, t, n) {
		var r = M();
		try {
			return J(e)(t, n);
		} catch (e) {
			if (j(r), e !== e + 0) throw e;
			$(1, 0);
		}
	}
	function or(e, t, n, r, i, a, o) {
		var s = M();
		try {
			return J(e)(t, n, r, i, a, o);
		} catch (e) {
			if (j(s), e !== e + 0) throw e;
			$(1, 0);
		}
	}
	function sr(e, t, n, r) {
		var i = M();
		try {
			return J(e)(t, n, r);
		} catch (e) {
			if (j(i), e !== e + 0) throw e;
			$(1, 0);
		}
	}
	function cr(e, t, n, r) {
		var i = M();
		try {
			return J(e)(t, n, r);
		} catch (e) {
			if (j(i), e !== e + 0) throw e;
			$(1, 0);
		}
	}
	function lr(e, t, n, r, i, a, o, s, c) {
		var l = M();
		try {
			J(e)(t, n, r, i, a, o, s, c);
		} catch (e) {
			if (j(l), e !== e + 0) throw e;
			$(1, 0);
		}
	}
	function ur(e, t, n, r, i, a, o, s) {
		var c = M();
		try {
			J(e)(t, n, r, i, a, o, s);
		} catch (e) {
			if (j(c), e !== e + 0) throw e;
			$(1, 0);
		}
	}
	function dr(e, t, n) {
		var r = M();
		try {
			return J(e)(t, n);
		} catch (e) {
			if (j(r), e !== e + 0) throw e;
			$(1, 0);
		}
	}
	function fr(e, t, n, r, i) {
		var a = M();
		try {
			return J(e)(t, n, r, i);
		} catch (e) {
			if (j(a), e !== e + 0) throw e;
			$(1, 0);
		}
	}
	function pr(e, t, n, r, i, a) {
		var o = M();
		try {
			return J(e)(t, n, r, i, a);
		} catch (e) {
			if (j(o), e !== e + 0) throw e;
			$(1, 0);
		}
	}
	function mr(e, t, n, r, i, a, o, s, c) {
		var l = M();
		try {
			return J(e)(t, n, r, i, a, o, s, c);
		} catch (e) {
			if (j(l), e !== e + 0) throw e;
			$(1, 0);
		}
	}
	function hr(e, t, n) {
		var r = M();
		try {
			J(e)(t, n);
		} catch (e) {
			if (j(r), e !== e + 0) throw e;
			$(1, 0);
		}
	}
	function gr(e, t, n, r, i, a, o) {
		var s = M();
		try {
			J(e)(t, n, r, i, a, o);
		} catch (e) {
			if (j(s), e !== e + 0) throw e;
			$(1, 0);
		}
	}
	function _r(e, t, n, r, i) {
		var a = M();
		try {
			J(e)(t, n, r, i);
		} catch (e) {
			if (j(a), e !== e + 0) throw e;
			$(1, 0);
		}
	}
	function vr(e, t, n, r, i, a, o) {
		var s = M();
		try {
			return Mn(e, t, n, r, i, a, o);
		} catch (e) {
			if (j(s), e !== e + 0) throw e;
			$(1, 0);
		}
	}
	function yr() {
		ee();
		function e() {
			var e, t;
			i.calledRun = !0, !h && (te(), (e = g) == null || e(i), (t = i.onRuntimeInitialized) == null || t.call(i), ne());
		}
		i.setStatus ? (i.setStatus("Running..."), setTimeout(() => {
			setTimeout(() => i.setStatus(""), 1), e();
		}, 1)) : e();
	}
	var br = await le();
	return yr(), t = v ? i : new Promise((e, t) => {
		g = e, _ = t;
	}), t;
}
//#endregion
//#region src/reader/index.ts
function E(e) {
	return m(T, e);
}
function D() {
	return ie(T);
}
function O(e) {
	return E({
		overrides: e,
		equalityFn: Object.is,
		fireImmediately: !0
	});
}
function k(e) {
	E({
		overrides: e,
		equalityFn: Object.is,
		fireImmediately: !1
	});
}
async function A(e, t) {
	return se(T, e, t);
}
async function ue(e, t) {
	return A(e, t);
}
async function de(e, t) {
	return A(e, t);
}
var fe = "aecc1876de036c62c8419f67a5e1a16b1698a325bcd190aa84810d516e263931";
//#endregion
export { w as BARCODE_FORMATS, h as BARCODE_HRI_LABELS, C as BARCODE_META_FORMATS, d as BARCODE_SYMBOLOGIES, p as BINARIZERS, y as CHARACTER_SETS, ae as CONTENT_TYPES, t as CREATABLE_BARCODE_FORMATS, g as EAN_ADD_ON_SYMBOLS, S as GS1_BARCODE_FORMATS, f as INDUSTRIAL_BARCODE_FORMATS, r as LINEAR_BARCODE_FORMATS, n as MATRIX_BARCODE_FORMATS, l as READABLE_BARCODE_FORMATS, ne as RETAIL_BARCODE_FORMATS, b as TEXT_MODES, oe as ZXING_CPP_COMMIT, fe as ZXING_WASM_SHA256, ee as ZXING_WASM_VERSION, e as barcodeFormats, le as binarizers, v as characterSets, x as contentTypes, re as defaultReaderOptions, _ as eanAddOnSymbols, te as encodeFormat, s as encodeFormats, c as formatToLabel, u as formatToSymbology, O as getZXingModule, i as linearBarcodeFormats, a as matrixBarcodeFormats, E as prepareZXingModule, D as purgeZXingModule, A as readBarcodes, de as readBarcodesFromImageData, ue as readBarcodesFromImageFile, k as setZXingModuleOverrides, o as symbologyToFormats, ce as textModes };
