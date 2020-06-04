var template;
var Har2JmxConverter = function() {

}

Har2JmxConverter.prototype.convert = function(template, harText) {
    var mainHashTree = template.getElementsByTagName("TransactionController").item(0).nextSibling.nextSibling;
    var jsonObj = JSON.parse(harText);

    var entries = jsonObj.log.entries;
    var entryNumber = 0;
    for (var entry of entries) {
        var request = entry.request;
        var url = request.url;
        var method = request.method;
        var queryString = request.queryString;
        var postData = request.postData;
        var headers = request.headers;
        
        if ("CONNECT" == method) {
        	continue;
        }

        var httpSamplerProxy = this.makeHTTPSampler(++entryNumber, url, method, queryString, postData, headers);
        mainHashTree.appendChild(httpSamplerProxy);

        var httpSamplerHashTree = this.createElement("hashTree");
        mainHashTree.appendChild(httpSamplerHashTree);

        var headerManager = this.makeHeaderManager(headers);
        httpSamplerHashTree.appendChild(headerManager);
        httpSamplerHashTree.appendChild(this.createElement("hashTree"));
    }

    return this.formattedXML();
}

Har2JmxConverter.prototype.formattedXML = function() {
    var xsltDoc = new DOMParser().parseFromString([
        // describes how we want to modify the XML - indent everything
        '<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform">',
        '  <xsl:strip-space elements="*"/>',
        '  <xsl:template match="para[content-style][not(text())]">', // change to just text() to strip space in text nodes
        '    <xsl:value-of select="normalize-space(.)"/>',
        '  </xsl:template>',
        '  <xsl:template match="node()|@*">',
        '    <xsl:copy><xsl:apply-templates select="node()|@*"/></xsl:copy>',
        '  </xsl:template>',
        '  <xsl:output indent="yes"/>',
        '</xsl:stylesheet>',
    ].join('\n'), 'application/xml');

    var xsltProcessor = new XSLTProcessor();
    xsltProcessor.importStylesheet(xsltDoc);
    var resultDoc = xsltProcessor.transformToDocument(template);
    var resultXml = new XMLSerializer().serializeToString(resultDoc);

    return resultXml;
}

Har2JmxConverter.prototype.createElement = function(ename, ...params) {
    var element = template.createElement(ename);

    if (params != null) {
        for (var i = 0; i < params.length; i += 2) {
            element.setAttribute(params[i], params[i + 1]);
        }
    }

    return element;
}

Har2JmxConverter.prototype.makeHTTPSampler = function(entryNumber, url, method, queryString, postData, headers) {
    var protocol = url.substring(0, url.indexOf(":"));
    url = url.substring(url.indexOf(":") + 3);
    var token;
    if (url.indexOf("/") == -1) {
        token = url.split(":");
    } else {
        token = url.substring(0, url.indexOf("/")).split(":");
    }
    var domain = token[0];
    var port = (token.length == 2 ? token[1] : "");
    if (url.indexOf("/") == -1) {
        url = "";
    } else {
        url = url.substring(url.indexOf("/"));
        if ("GET" == method && url.indexOf("?") >= 0) {
            url = url.substring(0, url.indexOf("?"));
        }
    }

    var testname = url + "-" + entryNumber;

    var httpSamplerProxy = this.createElement("HTTPSamplerProxy", "guiclass", "HttpTestSampleGui", "testclass",
        "HTTPSamplerProxy", "testname", testname, "enabled", "true");

    if ("POST" == method && postData != null && postData.hasOwnProperty("text")) {
        var boolProp = this.createElement("boolProp", "name", "HTTPSampler.postBodyRaw");
        httpSamplerProxy.appendChild(boolProp);
        boolProp.appendChild(document.createTextNode("true"));
    }

    var elementProp = this.makeArgumentsPart(method, queryString, postData);
    httpSamplerProxy.appendChild(elementProp);

    var domainStringProp = this.createElement("stringProp", "name", "HTTPSampler.domain");
    httpSamplerProxy.appendChild(domainStringProp);
    domainStringProp.appendChild(document.createTextNode(domain));

    var portStringProp = this.createElement("stringProp", "name", "HTTPSampler.port");
    httpSamplerProxy.appendChild(portStringProp);
    portStringProp.appendChild(document.createTextNode(port));

    var protocolStringProp = this.createElement("stringProp", "name", "HTTPSampler.protocol");
    httpSamplerProxy.appendChild(protocolStringProp);
    protocolStringProp.appendChild(document.createTextNode(protocol));

    var contentEncodingStringProp = this.createElement("stringProp", "name", "HTTPSampler.contentEncoding");
    httpSamplerProxy.appendChild(contentEncodingStringProp);
    var contentEncodingHeaderValue = this.getHeaderValue(headers, "content-type").toLowerCase();
    contentEncodingStringProp
        .appendChild(document.createTextNode(contentEncodingHeaderValue.indexOf("utf-8") >= 0 ? "UTF-8" : ""));

    var pathStringProp = this.createElement("stringProp", "name", "HTTPSampler.path");
    httpSamplerProxy.appendChild(pathStringProp);
    pathStringProp.appendChild(document.createTextNode(url));

    var methodStringProp = this.createElement("stringProp", "name", "HTTPSampler.method");
    httpSamplerProxy.appendChild(methodStringProp);
    methodStringProp.appendChild(document.createTextNode(method));

    var followRedirects = this.createElement("boolProp", "name", "HTTPSampler.follow_redirects");
    httpSamplerProxy.appendChild(followRedirects);
    followRedirects.appendChild(document.createTextNode("true"));

    var autoRedirects = this.createElement("boolProp", "name", "HTTPSampler.auto_redirects");
    httpSamplerProxy.appendChild(autoRedirects);
    autoRedirects.appendChild(document.createTextNode("false"));

    var useKeepAlive = this.createElement("boolProp", "name", "HTTPSampler.use_keepalive");
    httpSamplerProxy.appendChild(useKeepAlive);
    useKeepAlive.appendChild(document.createTextNode("true"));

    var doMultipartPost = this.createElement("boolProp", "name", "HTTPSampler.DO_MULTIPART_POST");
    httpSamplerProxy.appendChild(doMultipartPost);
    doMultipartPost.appendChild(document.createTextNode("false"));

    var embeddedUrlRe = this.createElement("stringProp", "name", "HTTPSampler.embedded_url_re");
    httpSamplerProxy.appendChild(embeddedUrlRe);
    embeddedUrlRe.appendChild(document.createTextNode(""));

    var implementation = this.createElement("stringProp", "name", "HTTPSampler.implementation");
    httpSamplerProxy.appendChild(implementation);
    implementation.appendChild(document.createTextNode("Java"));

    var connectTimeout = this.createElement("stringProp", "name", "HTTPSampler.connect_timeout");
    httpSamplerProxy.appendChild(connectTimeout);
    connectTimeout.appendChild(document.createTextNode(""));

    var responseTimeout = this.createElement("stringProp", "name", "HTTPSampler.response_timeout");
    httpSamplerProxy.appendChild(responseTimeout);
    responseTimeout.appendChild(document.createTextNode(""));

    return httpSamplerProxy;
}

Har2JmxConverter.prototype.makeArgumentsPart = function(method, queryString, postData) {
    var elementProp = this.createElement("elementProp", "name", "HTTPsampler.Arguments", "elementType", "Arguments",
        "guiclass", "HTTPArgumentsPanel", "testclass", "Arguments", "enabled", "true");

    if ("POST" == method && postData != null && postData.hasOwnProperty("text")) {
        elementProp.removeAttribute("guiclass");
        elementProp.removeAttribute("testclass");
        elementProp.removeAttribute("enabled");
    }

    var collectionProp = this.createElement("collectionProp", "name", "Arguments.arguments");
    elementProp.appendChild(collectionProp);

    if ("GET" == method || ("POST" == method && postData != null && postData.hasOwnProperty("params"))) {
        var queries = ("GET" == method ? queryString : postData.params);
        for (var query of queries) {
            var name = query.name;
            var value = query.value;
            var noName = false;

            if (name == null) {
                noName = true;
                name = value;
                value = "";
            }

            var argumentElementProp = this.createElement("elementProp", "name", name, "elementType", "HTTPArgument");
            collectionProp.appendChild(argumentElementProp);

            var alwaysEncodeBoolProp = this.createElement("boolProp", "name", "HTTPArgument.always_encode");
            argumentElementProp.appendChild(alwaysEncodeBoolProp);
            alwaysEncodeBoolProp.appendChild(document.createTextNode("true")); // default: false

            var argumentNameStringProp = this.createElement("stringProp", "name", "Argument.name");
            argumentElementProp.appendChild(argumentNameStringProp);
            argumentNameStringProp.appendChild(document.createTextNode(name));

            var argumentValueStringProp = this.createElement("stringProp", "name", "Argument.value");
            argumentElementProp.appendChild(argumentValueStringProp);
            argumentValueStringProp.appendChild(document.createTextNode(value));

            var argumentMetadataStringProp = this.createElement("stringProp", "name", "Argument.metadata");
            argumentElementProp.appendChild(argumentMetadataStringProp);
            argumentMetadataStringProp.appendChild(document.createTextNode(noName ? "" : "="));

            if (!noName) {
                var useEqualsBoolProp = this.createElement("boolProp", "name", "HTTPArgument.use_equals");
                argumentElementProp.appendChild(useEqualsBoolProp);
                useEqualsBoolProp.appendChild(document.createTextNode("true"));
            }
        }
    } else if ("POST" == method && postData != null && postData.hasOwnProperty("text")) {
        var argumentElementProp = this.createElement("elementProp", "name", "", "elementType", "HTTPArgument");
        collectionProp.appendChild(argumentElementProp);

        var alwaysEncodeBoolProp = this.createElement("boolProp", "name", "HTTPArgument.always_encode");
        argumentElementProp.appendChild(alwaysEncodeBoolProp);
        alwaysEncodeBoolProp.appendChild(document.createTextNode("false")); // default: false

        var argumentValueStringProp = this.createElement("stringProp", "name", "Argument.value");
        argumentElementProp.appendChild(argumentValueStringProp);
        var postBody = postData.text;
        argumentValueStringProp.appendChild(document.createTextNode(postBody));

        var argumentMetadataStringProp = this.createElement("stringProp", "name", "Argument.metadata");
        argumentElementProp.appendChild(argumentMetadataStringProp);
        argumentMetadataStringProp.appendChild(document.createTextNode("="));
    }

    return elementProp;
}

Har2JmxConverter.prototype.getHeaderValue = function(headers, headerName) {
    var headerValue = "";

    if (headers != null) {
        for (var header of headers) {
            if (header.name == headerName) {
                return header.value;
            }
        }
    }

    return headerValue;
}

Har2JmxConverter.prototype.makeHeaderManager = function(headers) {
    var headerManager = this.createElement("HeaderManager", "guiclass", "HeaderPanel", "testclass", "HeaderManager",
        "testname", "HTTP Header Manager", "enabled", "true");

    var collectionProp = this.createElement("collectionProp", "name", "HeaderManager.headers");
    headerManager.appendChild(collectionProp);

    for (var header of headers) {
        var headerName = header.name;
        var headerValue = header.value;

        if ("Cookie" == headerName) {
            continue;
        }

        var elementProp = this.createElement("elementProp", "name", headerName, "elementType", "Header");
        collectionProp.appendChild(elementProp);

        var stringPropForHeaderName = this.createElement("stringProp", "name", "Header.name");
        elementProp.appendChild(stringPropForHeaderName);
        stringPropForHeaderName.appendChild(document.createTextNode(headerName));

        var stringPropForHeaderValue = this.createElement("stringProp", "name", "Header.value");
        elementProp.appendChild(stringPropForHeaderValue);
        stringPropForHeaderValue.appendChild(document.createTextNode(headerValue));
    }

    return headerManager;
}
