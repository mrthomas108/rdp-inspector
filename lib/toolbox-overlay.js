/* See license.txt for terms of usage */

"use strict";

module.metadata = {
  "stability": "stable"
};

// Add-on SDK
const options = require("@loader/options");
const { Cu, Ci } = require("chrome");
const { Class } = require("sdk/core/heritage");

// Firebug SDK
const { Trace, TraceError } = require("firebug.sdk/lib/core/trace.js").get(module.id);
const { Locale } = require("firebug.sdk/lib/core/locale.js");
const { ToolboxOverlay: ToolboxOverlayBase } = require("firebug.sdk/lib/toolbox-overlay.js");
const { TransportObserver } = require("./transport-observer.js");
const { Arr } = require("firebug.sdk/lib/core/array.js");
const { Options } = require("firebug.sdk/lib/core/options.js");

// RDP Inspector
const { InspectorWindow } = require("./inspector-window.js");

/**
 * @overlay xxxHonza: TODO docs
 */
const ToolboxOverlay = Class(
/** @lends ToolboxOverlay */
{
  extends: ToolboxOverlayBase,

  overlayId: "RdpInspectorToolboxOverlay",

  packetCache: [],
  listeners: [],

  // Initialization

  initialize: function(options) {
    ToolboxOverlayBase.prototype.initialize.apply(this, arguments);

    Trace.sysout("ToolboxOverlay.initialize;", options);

    // Transport Protocol
    this.onSendPacket = this.onSendPacket.bind(this);
    this.onReceivePacket = this.onReceivePacket.bind(this);

    // Initialize transport observer
    let remotePromise = this.toolbox.target.makeRemote();
    let client = this.toolbox.target.client;
    this.transportObserver = new TransportObserver({client: client});
    this.transportObserver.addListener(this);

    // Number of removed packets from the cache that are out of limit.
    this.removedPackets = 0;
  },

  destroy: function() {
    ToolboxOverlayBase.prototype.destroy.apply(this, arguments);

    Trace.sysout("ToolboxOverlay.destroy;", arguments);

    if (this.transportObserver) {
      this.removeTransportListener(this);
      this.transportObserver.destroy();
    }

    if (this.inspector) {
      this.inspector.destroy();
    }
  },

  // Events

  onReady: function(options) {
    ToolboxOverlayBase.prototype.onReady.apply(this, arguments);

    Trace.sysout("ToolboxOverlay.onReady;", options);
  },

  // Transport Listener

  getPacketCache: function() {
    return {
      removedPackets: this.removedPackets,
      packets: this.packetCache
    }
  },

  addTransportListener: function(listener) {
    this.listeners.push(listener);

    // Stop caching as soon as the first listener is registered
    this.packetCache = null;
  },

  removeTransportListener: function(listener) {
    Arr.remove(this.listeners, listener);
  },

  onSendPacket: function(packet) {
    this.appendPacket({
      type: "send",
      packet: packet,
      time: (new Date()).getTime()
    });

    this.listeners.forEach(listener => {
      listener.onSendPacket(packet);
    });
  },

  onReceivePacket: function(packet) {
    this.appendPacket({
      type: "receive",
      packet: packet,
      time: (new Date()).getTime()
    });

    this.listeners.forEach(listener => {
      listener.onReceivePacket(packet);
    });
  },

  appendPacket: function(packet) {
    if (!this.packetCache) {
      return;
    }

    try {
      var string = JSON.stringify(packet);
      this.packetCache.push(JSON.parse(string));
    } catch (err) {
      Trace.sysout("ToolboxOverlay.appendPacket; ERROR" + err, err);

      // xxxHonza: create a new packet that displays an error in the
      // packet list UI.
      // this.packetCache.push({...});
      return;
    }

    var limit = Options.getPref("extensions.rdpinspector.packetCacheSize");
    while (this.packetCache.length > limit) {
      this.packetCache.shift();
      this.removedPackets++;
    }
  },

  // Commands

  toggleInspector: function() {
    Trace.sysout("ToolboxOverlay.toggleInspector;");

    if (!this.inspector) {
      this.inspector = new InspectorWindow(this);
    }

    // Show or hide the popup panel.
    this.inspector.toggle();

    return this.inspector;
  },
});

// Exports from this module
exports.ToolboxOverlay = ToolboxOverlay;
