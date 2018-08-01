import {$, $$, render, safe} from 'dat://pauls-uikit.hashbase.io/js/dom.js'

var backendUrl
main()

async function main () {
  // read backend info
  backendUrl = await (new DatArchive(window.location)).readFile('/backend.json')

  // attach form behavior
  $('#submit-btn').addEventListener('click', onClickSubmit)
  $('input[name="url"]').addEventListener('input', onChangeUrl)

  // render websiteGrid and refetch latest every 15 seconds
  fetchAndRenderwebsiteGrid()
  setInterval(fetchAndRenderwebsiteGrid, 15e3)
}

function onChangeUrl (e) {
  var url = e.target.value
  var submitBtn = $('#submit-btn')

  if (!url.length) {
    e.target.classList.remove('error')
  } else if ((/^dat:\/\/[0-9a-f]{64}\/?$/).test(url)) {
    submitBtn.removeAttribute('disabled')
    e.target.classList.remove('error')
  } else {
    e.target.classList.add('error')
  }
}

async function onClickSubmit (e) {
  console.log('submit')
  // e.preventDefault()
  console.log('submit')
  var btn = $('#submit-btn')
  btn.setAttribute('disabled', true)

  // // choose archive
  // btn.textContent = 'Choosing archive...'
  // var archive = await DatArchive.selectArchive({
  //   title: 'Select which site you want to submit',
  //   buttonLabel: 'Submit site'
  // })
  // var url = archive.url

  var url = $('input[name="url"]').value
  console.log(url)

  try {
    // load screenshot
    btn.textContent = 'Taking a screenshot...'
    var thumbnail = await experimental.capturePage(url, {width: 1200, height: 800, resizeTo: {width: 300, height: 200}})
    thumbnail = btoa(String.fromCharCode(...new Uint8Array(thumbnail))) // base64 encode

    // submit
    btn.textContent = 'Submitting...'
    var res = await (await fetch(`${backendUrl}/dats`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({url, thumbnail})})).json()
    if (res.success) {
      fetchAndRenderwebsiteGrid()
    } else {
      alert(res.error)
    }
  } catch (e) {
    console.error(e)
    alert(e.toString())
  }

  btn.textContent = 'Submit'
}

async function fetchAndRenderwebsiteGrid () {
  renderwebsiteGrid(await fetchwebsiteGrid())
}

async function fetchwebsiteGrid () {
  var res = await fetch(`${backendUrl}/dats`)
  return (await res.json()).dats
}

function renderwebsiteGrid (websiteGrid) {
  var container = $('#website-grid')
  container.innerHTML = ''

  for (var key in websiteGrid) {
    let dat = websiteGrid[key]
    container.append(render(`
      <a class="dat" href="${safe(dat.url)}" title="${safe(dat.title)}" target="_blank">
        <img src="${backendUrl}/thumbs/${safe(key)}.png" />
        <div class="website-title">${safe(dat.title)}</div>
        <div class="website-description">${safe(dat.description)}</div>
      </a>
    `))
  }
}