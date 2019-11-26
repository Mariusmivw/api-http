class API {
	constructor(base_url, use_https = true) {
		this.debug = require('debug')(`req_test:${base_url}`);
		this.base_url = base_url;
		this.http = use_https ? require('https') : require('http');
		this.debug(`using HTTP${use_https ? 'S' : ''}`);
	}

	register(name, path, method, data, data_type, callback) {
		if (Array.isArray(name)) {
			for (const item of name)
				this.register.apply(this, item);
			return;
		}
		if (typeof name == 'object') {
			callback = name.callback;
			data_type = name.data_type;
			data = name.data;
			method = name.method;
			path = name.path;
			name = name.name;
		}
		let i = 0;
		this[name] = new Function('...args', `
			return this.req('${path || `args[${i++}]`}', '${method || `args[${i++}]`}', ${data || `args[${i++}]`}, '${data_type || `args[${i++}]`}', ${callback || `args[${i++}]`});
		`);
		this.debug(`registered ${name} to ${path}`);
	}

	req(path, method, data, data_type, callback) {
		return new Promise((resolve, reject) => {
			if (typeof method == 'string' && typeof data_type == 'string' && typeof callback == 'function') {
				'default';
			} else if (typeof method == 'string' && typeof data == 'function' && typeof data_type == 'undefined' && typeof callback == 'undefined') {
				callback = data;
				data = undefined;
			} else if (typeof data == 'string' && typeof data_type == 'function' || typeof data_type == 'undefined') {
				callback = data_type;
				data_type = data;
				data = method;
				method = undefined;
			}
			method = method || 'GET'

			// handle query data
			if (data_type == 'query') {
				path += '?';
				for (const key in data) {
					path += key + '=' + data[key] + '&';
				}
				path = path.slice(0, -1);
			}

			// create request
			const req = this.http.request({
				'path': path,
				'host': this.base_url,
				'method': method
			}, res => {
				let response = '';
				res.setEncoding('utf8');
				res.on('data', chunk => response += chunk);
				res.on('error', err => {
					this.debug(err);
					reject(err);
				});
				res.on('end', () => {
					callback && callback(response, `http${this.use_https ? 's' : ''}://${this.base_url}${path}`);
					resolve(response);
				})
			});

			// handle any other data type
			if (data_type == 'string') {
				req.setHeader('Content-Length', Buffer.byteLength(data));
				req.write(data);
			} else if (data_type == 'json') {
				req.setHeader('Content-Type', 'application/json');
				req.setHeader('Content-Length', Buffer.byteLength(JSON.stringify(data)));
				req.write(JSON.stringify(data));
			} else if (data_type == 'multipart') {
				const bound = Math.random().toString().slice(2);
				req.setHeader('Content-Type', 'multipart/form-data; boundary=' + bound);
				const multipart = `--${bound}\r\nContent-Disposition: form-data; name="file"; filename="${data.file.name || data.file.filename || Math.random().toString(36).substring(2)}"\r\nContent-Transfer-Encoding: ${data.file.encoding || 'binary'}\r\n\r\n${data.file.contents || data.file.content || data.file}`;
				for (const field in data) {
					if (field != 'file' && field != 'embed') {
						multipart += `\r\n--${bound}\r\nContent-Disposition: form-data; name="${field}"\r\n\r\n${data[field]}`;
					}
				}
				multipart += `\r\n--${bound}--`;
				req.setHeader('Content-Length', Buffer.byteLength(multipart));
				req.write(multipart);
			}

			// send request
			req.end();
			this.debug(`${method.toUpperCase()} ${path}`);
		});
	}
}

module.exports = API;