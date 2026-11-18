// L'appli du studio dans le Dock : une vraie appli Mac (une fenêtre, le point sous l'icône, Cmd+Tab)
// qui affiche la page du studio servie sur 127.0.0.1. Elle ne démarre ni n'arrête le service : elle
// demande l'adresse du jour (avec son jeton) à ouvrir.sh --adresse, qui démarre le service s'il le faut.
//
// Réglages lus dans l'Info.plist du paquet (écrits par l'installation) :
//   StudioOuvrir         chemin de studio/lancement/ouvrir.sh dans la copie du dépôt du client
//   StudioEnvironnement  variables passées à ouvrir.sh (tests seulement)
//   StudioJournal        fichier où noter ce que fait l'appli
// Construit par construire.sh (binaire universel, signé ad hoc, gardé dans le dépôt).
// `Studio --verifier` écrit « OK appli <architecture> » et sort : l'installation s'en sert pour
// vérifier que l'appli se lance sur ce Mac avant de la poser.

import Cocoa
import WebKit

let VERSION = "1"

func architecture() -> String {
  #if arch(arm64)
  return "arm64"
  #else
  return "x86_64"
  #endif
}

if CommandLine.arguments.contains("--verifier") {
  _ = WKWebViewConfiguration()
  print("OK appli \(VERSION) \(architecture())")
  exit(0)
}

final class Delegue: NSObject, NSApplicationDelegate, NSWindowDelegate, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
  var fenetre: NSWindow!
  var vue: WKWebView!
  var attente: NSTextField!
  var adresse: URL?
  var hote = "127.0.0.1"
  var port = 0
  var demandeEnCours = false
  var derniereDemande = Date.distantPast
  var echecsChargement = 0

  let infos = Bundle.main.infoDictionary ?? [:]
  var nom: String { (infos["CFBundleName"] as? String) ?? "Studio" }

  func journal(_ t: String) {
    guard let f = infos["StudioJournal"] as? String, !f.isEmpty else { return }
    let ligne = "\(ISO8601DateFormatter().string(from: Date())) appli \(t)\n"
    if let h = FileHandle(forWritingAtPath: f) {
      h.seekToEndOfFile(); h.write(ligne.data(using: .utf8)!); h.closeFile()
    } else {
      try? ligne.write(toFile: f, atomically: false, encoding: .utf8)
    }
  }

  // ---------------------------------------------------------------- démarrage

  func applicationDidFinishLaunching(_ n: Notification) {
    NSApp.setActivationPolicy(.regular)
    construireMenus()
    construireFenetre()
    NSApp.activate(ignoringOtherApps: true)
    journal("lancée (\(architecture()))")
    demanderAdresse(force: true)
  }

  // Clic sur l'icône du Dock alors que l'appli tourne : on remontre la fenêtre (jamais une deuxième),
  // et on revérifie l'adresse (le service a pu redémarrer depuis, avec un nouveau jeton).
  func applicationShouldHandleReopen(_ s: NSApplication, hasVisibleWindows: Bool) -> Bool {
    montrer()
    demanderAdresse(force: false)
    return true
  }

  // Fermer la fenêtre ne quitte pas l'appli ; quitter l'appli n'arrête pas le service (launchd le garde).
  func applicationShouldTerminateAfterLastWindowClosed(_ s: NSApplication) -> Bool { false }

  func montrer() {
    if fenetre.isMiniaturized { fenetre.deminiaturize(nil) }
    fenetre.makeKeyAndOrderFront(nil)
    NSApp.activate(ignoringOtherApps: true)
  }

  func construireFenetre() {
    let config = WKWebViewConfiguration()
    config.mediaTypesRequiringUserActionForPlayback = []
    config.allowsAirPlayForMediaPlayback = true
    if #available(macOS 12.3, *) { config.preferences.isElementFullscreenEnabled = true }
    config.preferences.javaScriptCanOpenWindowsAutomatically = false
    // La page prévient quand le jeton n'est plus bon (service redémarré) : on redemande l'adresse.
    let script = WKUserScript(source: """
      window.addEventListener("studio-deconnecte", function () {
        try { window.webkit.messageHandlers.studio.postMessage("deconnecte"); } catch (e) {}
      });
      """, injectionTime: .atDocumentStart, forMainFrameOnly: true)
    config.userContentController.addUserScript(script)
    config.userContentController.add(self, name: "studio")

    vue = WKWebView(frame: .zero, configuration: config)
    vue.navigationDelegate = self
    vue.uiDelegate = self
    vue.allowsBackForwardNavigationGestures = false
    vue.allowsMagnification = true

    let ecran = NSScreen.main?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1440, height: 920)
    let l = min(1440, ecran.width - 40), h = min(920, ecran.height - 40)
    fenetre = NSWindow(contentRect: NSRect(x: 0, y: 0, width: l, height: h),
                       styleMask: [.titled, .closable, .miniaturizable, .resizable],
                       backing: .buffered, defer: false)
    fenetre.title = nom
    fenetre.minSize = NSSize(width: 820, height: 560)
    fenetre.isReleasedWhenClosed = false
    fenetre.delegate = self
    fenetre.tabbingMode = .disallowed
    fenetre.collectionBehavior.insert(.fullScreenPrimary)

    let fond = NSView()
    attente = NSTextField(labelWithString: "Ton studio s'ouvre…")
    attente.font = NSFont.systemFont(ofSize: 15, weight: .medium)
    attente.textColor = .secondaryLabelColor
    attente.translatesAutoresizingMaskIntoConstraints = false
    vue.translatesAutoresizingMaskIntoConstraints = false
    vue.isHidden = true
    fond.addSubview(attente); fond.addSubview(vue)
    NSLayoutConstraint.activate([
      attente.centerXAnchor.constraint(equalTo: fond.centerXAnchor),
      attente.centerYAnchor.constraint(equalTo: fond.centerYAnchor),
      vue.leadingAnchor.constraint(equalTo: fond.leadingAnchor),
      vue.trailingAnchor.constraint(equalTo: fond.trailingAnchor),
      vue.topAnchor.constraint(equalTo: fond.topAnchor),
      vue.bottomAnchor.constraint(equalTo: fond.bottomAnchor),
    ])
    fenetre.contentView = fond
    fenetre.center()
    fenetre.setFrameAutosaveName("FenetreStudio")
    fenetre.makeKeyAndOrderFront(nil)
  }

  // ---------------------------------------------------------------- l'adresse du studio

  // Lance ouvrir.sh --adresse (hors du fil principal) : « URL <adresse> » ou « ALERTE <phrase> ».
  // force = false : rien si une demande vient d'être faite (moins de 5 s) ou est en cours.
  func demanderAdresse(force: Bool) {
    if demandeEnCours { return }
    if !force && Date().timeIntervalSince(derniereDemande) < 5 { return }
    guard let ouvrir = infos["StudioOuvrir"] as? String, FileManager.default.fileExists(atPath: ouvrir) else {
      alerter("Le studio n’est plus installé sur ce Mac.", quitter: true); return
    }
    demandeEnCours = true
    derniereDemande = Date()
    DispatchQueue.global(qos: .userInitiated).async {
      let p = Process()
      p.executableURL = URL(fileURLWithPath: "/bin/bash")
      p.arguments = [ouvrir, "--adresse"]
      var env = ProcessInfo.processInfo.environment
      if let e = self.infos["StudioEnvironnement"] as? [String: String] { for (k, v) in e { env[k] = v } }
      p.environment = env
      let sortie = Pipe()
      p.standardOutput = sortie
      p.standardError = FileHandle.nullDevice
      p.standardInput = FileHandle.nullDevice
      var texte = ""
      do {
        try p.run()
        let d = sortie.fileHandleForReading.readDataToEndOfFile()
        p.waitUntilExit()
        texte = String(data: d, encoding: .utf8) ?? ""
      } catch {
        texte = "ALERTE Le studio n’arrive pas à démarrer."
      }
      DispatchQueue.main.async {
        self.demandeEnCours = false
        self.adresseRecue(texte)
      }
    }
  }

  func adresseRecue(_ texte: String) {
    var url: URL?
    var alerte: String?
    for l in texte.split(separator: "\n") {
      if l.hasPrefix("URL ") { url = URL(string: String(l.dropFirst(4)).trimmingCharacters(in: .whitespaces)) }
      if l.hasPrefix("ALERTE ") { alerte = String(l.dropFirst(7)) }
    }
    guard let u = url, let h = u.host, let p = u.port else {
      journal("pas d'adresse : \(alerte ?? "réponse vide")")
      alerter(alerte ?? "Le studio n’arrive pas à démarrer.", quitter: adresse == nil)
      return
    }
    hote = h; port = p
    if adresse == u && !vue.isHidden { return }   // même démarrage du service : la page reste telle quelle
    let premiere = adresse == nil
    adresse = u
    journal(premiere ? "ouverture" : "nouveau jeton : la page est rechargée")
    // Garder l'endroit où on était (dossier ouvert) : la partie après # de la page en cours.
    var cible = u
    if !premiere, let frag = vue.url?.fragment, var c = URLComponents(url: u, resolvingAgainstBaseURL: false) {
      c.fragment = frag
      cible = c.url ?? u
    }
    echecsChargement = 0
    vue.load(URLRequest(url: cible))
  }

  func alerter(_ phrase: String, quitter: Bool) {
    let a = NSAlert()
    a.messageText = nom
    a.informativeText = phrase
    a.alertStyle = .warning
    a.addButton(withTitle: "OK")
    a.runModal()
    if quitter { NSApp.terminate(nil) }
  }

  // Repli : la page ne s'affiche pas dans l'appli, on ouvre le studio dans le navigateur comme avant.
  func replierVersNavigateur() {
    journal("repli vers le navigateur")
    if let ouvrir = infos["StudioOuvrir"] as? String {
      let p = Process()
      p.executableURL = URL(fileURLWithPath: "/bin/bash")
      p.arguments = [ouvrir, "--navigateur"]
      var env = ProcessInfo.processInfo.environment
      if let e = infos["StudioEnvironnement"] as? [String: String] { for (k, v) in e { env[k] = v } }
      p.environment = env
      try? p.run()
      p.waitUntilExit()
    }
    NSApp.terminate(nil)
  }

  // ---------------------------------------------------------------- la page

  func estStudio(_ u: URL?) -> Bool {
    guard let u = u else { return false }
    if u.scheme == "about" || u.scheme == "blob" || u.scheme == "data" { return true }
    return (u.scheme == "http") && u.host == hote && u.port == port
  }

  func ouvrirDehors(_ u: URL) {
    if u.scheme == "http" || u.scheme == "https" || u.scheme == "mailto" { NSWorkspace.shared.open(u) }
  }

  // Seule la page du studio s'affiche dans la fenêtre ; un lien vers ailleurs s'ouvre dans le
  // navigateur ; un fichier lâché à côté d'une zone prévue ne remplace pas la page.
  func webView(_ w: WKWebView, decidePolicyFor a: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
    guard let u = a.request.url else { decisionHandler(.cancel); return }
    if u.isFileURL { journal("fichier lâché hors d'une zone : ignoré"); decisionHandler(.cancel); return }
    if estStudio(u) || a.targetFrame?.isMainFrame == false { decisionHandler(.allow); return }
    ouvrirDehors(u)
    decisionHandler(.cancel)
  }

  func webView(_ w: WKWebView, decidePolicyFor r: WKNavigationResponse, decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
    if !r.canShowMIMEType, let u = r.response.url { ouvrirDehors(u); decisionHandler(.cancel); return }
    decisionHandler(.allow)
  }

  // target="_blank" et window.open : jamais de deuxième fenêtre, le lien part dans le navigateur.
  func webView(_ w: WKWebView, createWebViewWith c: WKWebViewConfiguration, for a: WKNavigationAction, windowFeatures f: WKWindowFeatures) -> WKWebView? {
    if let u = a.request.url {
      if estStudio(u) { w.load(a.request) } else { ouvrirDehors(u) }
    }
    return nil
  }

  func webView(_ w: WKWebView, didFinish n: WKNavigation!) {
    echecsChargement = 0
    vue.isHidden = false
    attente.isHidden = true
  }

  func webView(_ w: WKWebView, didFailProvisionalNavigation n: WKNavigation!, withError e: Error) {
    let code = (e as NSError).code
    if code == NSURLErrorCancelled || code == 102 { return }   // 102 : chargement remplacé (lien ouvert ailleurs)
    echecsChargement += 1
    journal("chargement impossible (\(code)), essai \(echecsChargement)")
    if echecsChargement >= 3 { replierVersNavigateur(); return }
    adresse = nil
    DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { self.demanderAdresse(force: true) }
  }

  func webViewWebContentProcessDidTerminate(_ w: WKWebView) {
    journal("page arrêtée par le système : rechargée")
    w.reload()
  }

  func userContentController(_ u: WKUserContentController, didReceive m: WKScriptMessage) {
    if (m.body as? String) == "deconnecte" { demanderAdresse(force: false) }
  }

  // Champ « choisir un fichier » de la page.
  func webView(_ w: WKWebView, runOpenPanelWith p: WKOpenPanelParameters, initiatedByFrame f: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
    let panneau = NSOpenPanel()
    panneau.allowsMultipleSelection = p.allowsMultipleSelection
    panneau.canChooseDirectories = p.allowsDirectories
    panneau.canChooseFiles = true
    panneau.beginSheetModal(for: fenetre) { r in completionHandler(r == .OK ? panneau.urls : nil) }
  }

  func webView(_ w: WKWebView, runJavaScriptAlertPanelWithMessage m: String, initiatedByFrame f: WKFrameInfo, completionHandler: @escaping () -> Void) {
    let a = NSAlert(); a.messageText = nom; a.informativeText = m; a.addButton(withTitle: "OK")
    a.beginSheetModal(for: fenetre) { _ in completionHandler() }
  }

  func webView(_ w: WKWebView, runJavaScriptConfirmPanelWithMessage m: String, initiatedByFrame f: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
    let a = NSAlert(); a.messageText = nom; a.informativeText = m
    a.addButton(withTitle: "OK"); a.addButton(withTitle: "Annuler")
    a.beginSheetModal(for: fenetre) { r in completionHandler(r == .alertFirstButtonReturn) }
  }

  func webView(_ w: WKWebView, runJavaScriptTextInputPanelWithPrompt m: String, defaultText d: String?, initiatedByFrame f: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
    let a = NSAlert(); a.messageText = nom; a.informativeText = m
    let champ = NSTextField(frame: NSRect(x: 0, y: 0, width: 280, height: 24)); champ.stringValue = d ?? ""
    a.accessoryView = champ
    a.addButton(withTitle: "OK"); a.addButton(withTitle: "Annuler")
    a.beginSheetModal(for: fenetre) { r in completionHandler(r == .alertFirstButtonReturn ? champ.stringValue : nil) }
  }

  // ---------------------------------------------------------------- menus

  @objc func recharger(_ s: Any?) { if vue.url == nil { demanderAdresse(force: true) } else { vue.reload() } }
  @objc func zoomPlus(_ s: Any?) { if #available(macOS 11.0, *) { vue.pageZoom = min(vue.pageZoom + 0.1, 2) } }
  @objc func zoomMoins(_ s: Any?) { if #available(macOS 11.0, *) { vue.pageZoom = max(vue.pageZoom - 0.1, 0.6) } }
  @objc func zoomNormal(_ s: Any?) { if #available(macOS 11.0, *) { vue.pageZoom = 1 } }

  func construireMenus() {
    let barre = NSMenu()
    func menu(_ titre: String, _ items: [NSMenuItem]) -> NSMenu {
      let m = NSMenu(title: titre)
      for i in items { m.addItem(i) }
      let porteur = NSMenuItem(title: titre, action: nil, keyEquivalent: "")
      porteur.submenu = m
      barre.addItem(porteur)
      return m
    }
    func item(_ t: String, _ a: Selector?, _ k: String, _ mods: NSEvent.ModifierFlags = .command, cible: AnyObject? = nil) -> NSMenuItem {
      let i = NSMenuItem(title: t, action: a, keyEquivalent: k)
      i.keyEquivalentModifierMask = mods
      if let c = cible { i.target = c }
      return i
    }
    _ = menu(nom, [
      item("À propos de \(nom)", #selector(NSApplication.orderFrontStandardAboutPanel(_:)), ""),
      .separator(),
      item("Masquer \(nom)", #selector(NSApplication.hide(_:)), "h"),
      item("Masquer les autres", #selector(NSApplication.hideOtherApplications(_:)), "h", [.command, .option]),
      item("Tout afficher", #selector(NSApplication.unhideAllApplications(_:)), ""),
      .separator(),
      item("Quitter \(nom)", #selector(NSApplication.terminate(_:)), "q"),
    ])
    _ = menu("Édition", [
      item("Annuler", Selector(("undo:")), "z"),
      item("Rétablir", Selector(("redo:")), "z", [.command, .shift]),
      .separator(),
      item("Couper", #selector(NSText.cut(_:)), "x"),
      item("Copier", #selector(NSText.copy(_:)), "c"),
      item("Coller", #selector(NSText.paste(_:)), "v"),
      item("Tout sélectionner", #selector(NSText.selectAll(_:)), "a"),
    ])
    _ = menu("Présentation", [
      item("Recharger la page", #selector(recharger(_:)), "r", cible: self),
      .separator(),
      item("Taille réelle", #selector(zoomNormal(_:)), "0", cible: self),
      item("Agrandir", #selector(zoomPlus(_:)), "+", cible: self),
      item("Réduire le texte", #selector(zoomMoins(_:)), "-", cible: self),
      .separator(),
      item("Plein écran", #selector(NSWindow.toggleFullScreen(_:)), "f", [.command, .control]),
    ])
    let fen = menu("Fenêtre", [
      item("Placer dans le Dock", #selector(NSWindow.performMiniaturize(_:)), "m"),
      item("Fermer la fenêtre", #selector(NSWindow.performClose(_:)), "w"),
    ])
    NSApp.mainMenu = barre
    NSApp.windowsMenu = fen
  }
}

let app = NSApplication.shared
let delegue = Delegue()
app.delegate = delegue
app.run()
