from typer import Typer

app = Typer(name='cairo')

@app.command()
def main() -> None:
    print("Hello from cairo!")
